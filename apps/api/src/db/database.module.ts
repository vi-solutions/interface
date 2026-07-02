import { Module, Global } from "@nestjs/common";
import { Pool, types } from "pg";

export const DATABASE_POOL = "DATABASE_POOL";
const POSTGRES_DATE_OID = 1082;

types.setTypeParser(POSTGRES_DATE_OID, (value) => value);

const poolProvider = {
  provide: DATABASE_POOL,
  useFactory: () => {
    return new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/interface_env",
    });
  },
};

@Global()
@Module({
  providers: [poolProvider],
  exports: [poolProvider],
})
export class DatabaseModule {}
