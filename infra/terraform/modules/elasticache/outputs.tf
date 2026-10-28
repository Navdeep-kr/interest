output "redis_primary_endpoint" {
  description = "The primary endpoint address of the Redis replication group"
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "The reader endpoint address for read-scaling"
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.this.port
}

output "redis_security_group_id" {
  description = "The security group ID for Redis"
  value       = aws_security_group.redis_sg.id
}
