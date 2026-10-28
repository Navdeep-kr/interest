# =============================================================================
# S3 Storage Module (Raw Uploads, HLS Video, Static Assets, Backups)
# =============================================================================

# KMS Key for Object Encryption
resource "aws_kms_key" "s3_kms" {
  description             = "KMS Key for ${var.project_name} S3 storage encryption in ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "${var.project_name}-s3-kms-${var.environment}"
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# 1. Raw Video Uploads Bucket (Ingress)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "raw_uploads" {
  bucket        = "${var.project_name}-raw-uploads-${var.environment}"
  force_destroy = var.environment == "production" ? false : true

  tags = {
    Name        = "${var.project_name}-raw-uploads-${var.environment}"
    Type        = "Ingress"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw_uploads_enc" {
  bucket = aws_s3_bucket.raw_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_kms.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "raw_uploads_pab" {
  bucket                  = aws_s3_bucket.raw_uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "raw_uploads_cors" {
  bucket = aws_s3_bucket.raw_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = var.allowed_cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_uploads_lifecycle" {
  bucket = aws_s3_bucket.raw_uploads.id

  rule {
    id     = "abort-incomplete-multipart-and-archive"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 180
    }
  }
}

# -----------------------------------------------------------------------------
# 2. Transcoded HLS Video Segments Bucket (Streaming Storage)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "hls_video" {
  bucket        = "${var.project_name}-hls-video-${var.environment}"
  force_destroy = var.environment == "production" ? false : true

  tags = {
    Name        = "${var.project_name}-hls-video-${var.environment}"
    Type        = "Streaming"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "hls_video_enc" {
  bucket = aws_s3_bucket.hls_video.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_kms.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "hls_video_pab" {
  bucket                  = aws_s3_bucket.hls_video.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# 3. Static Assets & Thumbnails Bucket
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "assets" {
  bucket        = "${var.project_name}-assets-${var.environment}"
  force_destroy = var.environment == "production" ? false : true

  tags = {
    Name        = "${var.project_name}-assets-${var.environment}"
    Type        = "Assets"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "assets_pab" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# 4. Disaster Recovery Backups Bucket
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "backups" {
  bucket        = "${var.project_name}-backups-${var.environment}"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-backups-${var.environment}"
    Type        = "DisasterRecovery"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "backups_versioning" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "backups_pab" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
