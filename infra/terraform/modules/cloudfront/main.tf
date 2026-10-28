# =============================================================================
# CloudFront CDN Module with Zero-Location Edge Sanitizer
# =============================================================================

# Origin Access Control (OAC) for S3
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-hls-oac-${var.environment}"
  description                       = "OAC for streaming HLS video segments"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Attach OAC read policy to S3 HLS bucket
resource "aws_s3_bucket_policy" "hls_oac_policy" {
  bucket = var.hls_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.hls_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      }
    ]
  })
}

# Edge Function: Zero-Location Request Sanitizer
# Strips all geo headers at the CDN edge before reaching origins
resource "aws_cloudfront_function" "zero_location_edge_sanitizer" {
  name    = "${var.project_name}-edge-geo-sanitizer-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Strips CloudFront-Viewer-Country and geographic headers to enforce zero-location invariant"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var headers = request.headers;

      // Delete all incoming geographic and regional headers
      delete headers['cloudfront-viewer-country'];
      delete headers['cloudfront-viewer-city'];
      delete headers['cloudfront-viewer-postal-code'];
      delete headers['cloudfront-viewer-latitude'];
      delete headers['cloudfront-viewer-longitude'];
      delete headers['cf-ipcountry'];
      delete headers['x-forwarded-geo'];

      return request;
    }
  EOT
}

# Cache Policy for Playlist Manifests (.m3u8 - Short TTL)
resource "aws_cloudfront_cache_policy" "hls_manifest_policy" {
  name        = "${var.project_name}-manifest-policy-${var.environment}"
  comment     = "Cache policy for fast-updating HLS playlists"
  default_ttl = 60
  max_ttl     = 300
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache Policy for Immutable Video Segments (.ts - 1 Year TTL)
resource "aws_cloudfront_cache_policy" "hls_segment_policy" {
  name        = "${var.project_name}-segment-policy-${var.environment}"
  comment     = "Cache policy for immutable HLS video TS chunks"
  default_ttl = 31536000 # 1 year
  max_ttl     = 31536000
  min_ttl     = 86400

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name              = var.hls_bucket_regional_domain_name
    origin_id                = "S3-HLS-Bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Global CDN for Interest HLS video streams (${var.environment})"
  price_class         = "PriceClass_All"

  # Default Behavior (Manifests / Playlists)
  default_cache_behavior {
    target_origin_id       = "S3-HLS-Bucket"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.hls_manifest_policy.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.zero_location_edge_sanitizer.arn
    }
  }

  # Ordered Cache Behavior: Immutable .ts chunks
  ordered_cache_behavior {
    path_pattern           = "*.ts"
    target_origin_id       = "S3-HLS-Bucket"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.hls_segment_policy.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.zero_location_edge_sanitizer.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none" # Invariant: Zero geographic restriction
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-cdn-${var.environment}"
    Environment = var.environment
  }
}
