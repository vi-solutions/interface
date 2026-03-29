import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./db/database.module";
import { AuthModule } from "./auth/auth.module";
import { ClientsModule } from "./clients/clients.module";
import { ProjectsModule } from "./projects/projects.module";
import { TimeEntriesModule } from "./time-entries/time-entries.module";
import { UsersModule } from "./users/users.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { ProjectExpensesModule } from "./project-expenses/project-expenses.module";
import { UserExpensesModule } from "./user-expenses/user-expenses.module";
import { MilestonesModule } from "./milestones/milestones.module";
import { ContactsModule } from "./contacts/contacts.module";
import { ProjectContactsModule } from "./project-contacts/project-contacts.module";
import { TimeCategoriesModule } from "./time-categories/time-categories.module";
import { ProjectTimeCategoriesModule } from "./project-time-categories/project-time-categories.module";
import { ProjectUserRatesModule } from "./project-user-rates/project-user-rates.module";
import { QuickbooksModule } from "./quickbooks/quickbooks.module";
import { GoogleDriveModule } from "./google-drive/google-drive.module";
import { AuthGuard } from "./auth/auth.guard";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    TimeEntriesModule,
    UsersModule,
    DocumentsModule,
    ExpensesModule,
    ProjectExpensesModule,
    UserExpensesModule,
    MilestonesModule,
    ContactsModule,
    ProjectContactsModule,
    TimeCategoriesModule,
    ProjectTimeCategoriesModule,
    ProjectUserRatesModule,
    QuickbooksModule,
    GoogleDriveModule,
  ],
  providers: [{ provide: APP_GUARD, useExisting: AuthGuard }],
})
export class AppModule {}
