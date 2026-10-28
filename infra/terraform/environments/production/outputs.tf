output "alb_dns_name" {
  description = "Application Load Balancer DNS"
  value       = module.ecs.alb_dns_name
}

output "cdn_domain_name" {
  description = "CloudFront HLS Streaming Domain"
  value       = module.cloudfront.cloudfront_distribution_domain_name
}

output "rds_endpoint" {
  description = "PostgreSQL primary endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_primary_endpoint" {
  description = "Redis cluster primary endpoint"
  value       = module.elasticache.redis_primary_endpoint
}
