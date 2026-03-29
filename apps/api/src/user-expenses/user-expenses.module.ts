import { Module } from "@nestjs/common";
import { QuickbooksModule } from "../quickbooks/quickbooks.module";
import { UserExpensesController } from "./user-expenses.controller";
import { UserExpensesService } from "./user-expenses.service";

@Module({
  imports: [QuickbooksModule],
  controllers: [UserExpensesController],
  providers: [UserExpensesService],
  exports: [UserExpensesService],
})
export class UserExpensesModule {}
