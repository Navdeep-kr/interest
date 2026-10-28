# =============================================================================
# RDS PostgreSQL 16 with pgvector Module
# =============================================================================

# KMS Key for Database Encryption
resource "aws_kms_key" "rds_kms" {
  description             = "KMS Key for ${var.project_name} PostgreSQL encryption in ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "${var.project_name}-rds-kms-${var.environment}"
    Environment = var.environment
  }
}

# Subnet Group across private DB subnets
resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-rds-subnet-group-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.project_name}-rds-subnets-${var.environment}"
    Environment = var.environment
  }
}

# Parameter Group enabling pgvector
resource "aws_db_parameter_group" "pgvector" {
  name   = "${var.project_name}-postgres16-pgvector-${var.environment}"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }

  parameter {
    name  = "max_connections"
    value = var.max_connections
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "work_mem"
    value = "65536" # 64MB for high dimensional vector indexing
  }

  tags = {
    Name        = "${var.project_name}-pgvector-pg-${var.environment}"
    Environment = var.environment
  }
}

# Security Group: Restrict access strictly to ECS application subnets
resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Controls inbound traffic to RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS application tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.app_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-rds-sg-${var.environment}"
    Environment = var.environment
  }
}

# RDS DB Instance
resource "aws_db_instance" "this" {
  identifier                  = "${var.project_name}-postgres-${var.environment}"
  engine                      = "postgres"
  engine_version              = "16.1"
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = var.max_allocated_storage
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.rds_kms.arn

  db_name                     = var.db_name
  username                    = var.db_username
  password                    = var.db_password
  port                        = 5432

  multi_az                    = var.multi_az
  db_subnet_group_name        = aws_db_subnet_group.this.name
  parameter_group_name        = aws_db_parameter_group.pgvector.name
  vpc_security_group_ids      = [aws_security_group.rds_sg.id]

  backup_retention_period     = var.backup_retention_days
  backup_window               = "03:00-04:00"
  maintenance_window          = "Sun:04:30-Sun:05:30"
  auto_minor_version_upgrade  = true
  copy_tags_to_snapshot       = true
  deletion_protection         = var.environment == "production" ? true : false
  skip_final_snapshot         = var.environment == "production" ? false : true
  final_snapshot_identifier   = "${var.project_name}-postgres-${var.environment}-final-snapshot"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id       = aws_kms_key.rds_kms.arn

  tags = {
    Name        = "${var.project_name}-postgres-${var.environment}"
    Environment = var.environment
  }
}
