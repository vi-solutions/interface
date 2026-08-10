import { Module } from "@nestjs/common";
import { TimeRemindersService } from "./time-reminders.service";

@Module({
  providers: [TimeRemindersService],
})
export class TimeRemindersModule {}
