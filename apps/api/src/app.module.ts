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
  ],
  providers: [{ provide: APP_GUARD, useExisting: AuthGuard }],
})
export class AppModule {}
