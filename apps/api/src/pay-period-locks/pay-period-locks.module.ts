import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db/database.module";
import { PayPeriodLocksController } from "./pay-period-locks.controller";
import { PayPeriodLocksService } from "./pay-period-locks.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PayPeriodLocksController],
  providers: [PayPeriodLocksService],
})
export class PayPeriodLocksModule {}
