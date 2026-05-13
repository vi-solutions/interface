import { Module } from "@nestjs/common";
import { QuickbooksModule } from "../quickbooks/quickbooks.module";
import { ProjectUserRatesModule } from "../project-user-rates/project-user-rates.module";
import { UserExpensesController } from "./user-expenses.controller";
import { UserExpensesService } from "./user-expenses.service";

@Module({
  imports: [QuickbooksModule, ProjectUserRatesModule],
  controllers: [UserExpensesController],
  providers: [UserExpensesService],
  exports: [UserExpensesService],
})
export class UserExpensesModule {}
