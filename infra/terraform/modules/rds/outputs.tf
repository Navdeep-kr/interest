output "db_instance_id" {
  description = "The ID of the RDS database instance"
  value       = aws_db_instance.this.id
}

output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS database instance"
  value       = aws_db_instance.this.endpoint
}

output "db_instance_address" {
  description = "The hostname address of the RDS database instance"
  value       = aws_db_instance.this.address
}

output "db_instance_port" {
  description = "The database port"
  value       = aws_db_instance.this.port
}

output "db_security_group_id" {
  description = "The ID of the RDS security group"
  value       = aws_security_group.rds_sg.id
}
