output "cloudfront_cdn_domain" {
  description = "CloudFront HLS video delivery domain"
  value       = aws_cloudfront_distribution.hls_cdn.domain_name
}

output "rds_postgres_endpoint" {
  description = "PostgreSQL 16 endpoint with pgvector extension enabled"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_primary_endpoint" {
  description = "Redis replication group primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_hls_bucket_name" {
  value = aws_s3_bucket.reels_hls.id
}
