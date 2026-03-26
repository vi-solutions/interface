import { Module } from "@nestjs/common";
import { UserExpensesController } from "./user-expenses.controller";
import { UserExpensesService } from "./user-expenses.service";

@Module({
  controllers: [UserExpensesController],
  providers: [UserExpensesService],
  exports: [UserExpensesService],
})
export class UserExpensesModule {}
