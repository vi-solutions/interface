import { Module } from "@nestjs/common";
import { QuickbooksModule } from "../quickbooks/quickbooks.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [QuickbooksModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
