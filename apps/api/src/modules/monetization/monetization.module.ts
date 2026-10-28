import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { MonetizationController } from './monetization.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { FinancePayoutsService } from './finance-payouts.service';
import { SubscriptionsService } from './subscriptions.service';
import { TipsService } from './tips.service';
import { PaidCommunitiesService } from './communities.service';
import { CreatorFundService } from './creator-fund.service';
import { AdsService } from './ads.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [MonetizationController],
  providers: [
    PaymentGatewayService,
    FinancePayoutsService,
    SubscriptionsService,
    TipsService,
    PaidCommunitiesService,
    CreatorFundService,
    AdsService,
  ],
  exports: [
    PaymentGatewayService,
    FinancePayoutsService,
    SubscriptionsService,
    TipsService,
    PaidCommunitiesService,
    CreatorFundService,
    AdsService,
  ],
})
export class MonetizationModule {}
