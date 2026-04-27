import { Module } from "@nestjs/common";
import { QuickbooksModule } from "../quickbooks/quickbooks.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [QuickbooksModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
