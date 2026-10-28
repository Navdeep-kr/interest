output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "cdn_domain_name" {
  value = module.cloudfront.cloudfront_distribution_domain_name
}

output "rds_endpoint" {
  value = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  value = module.elasticache.redis_primary_endpoint
}
