# =============================================================================
# ElastiCache Redis 7 Replication Group Module
# =============================================================================

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.project_name}-redis-subnet-group-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.project_name}-redis-subnets-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group" "redis_sg" {
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Controls inbound traffic to Redis ElastiCache"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis port from ECS application tasks"
    from_port       = 6379
    to_port         = 6379
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
    Name        = "${var.project_name}-redis-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.project_name}-redis7-pg-${var.environment}"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name        = "${var.project_name}-redis-pg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.project_name}-redis-${var.environment}"
  description                = "Redis cluster for BullMQ queues, sliding rate limits, and Bloom deduplication"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_clusters
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis.name
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis_sg.id]

  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token

  snapshot_retention_limit   = var.snapshot_retention_limit
  snapshot_window            = "02:00-03:00"
  maintenance_window         = "sun:03:30-sun:04:30"
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.project_name}-redis-${var.environment}"
    Environment = var.environment
  }
}
