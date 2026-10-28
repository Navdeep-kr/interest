output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.id
}

output "cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.arn
}

output "cloudfront_distribution_domain_name" {
  description = "The domain name of the CloudFront distribution for HLS streaming"
  value       = aws_cloudfront_distribution.cdn.domain_name
}
