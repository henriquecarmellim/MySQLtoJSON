import readline from "node:readline";

export interface DBConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ConfigOverrides {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Partial<DBConfig> {
  const out: Partial<DBConfig> = {};
  if (env.MYSQL_HOST) out.host = env.MYSQL_HOST;
  if (env.MYSQL_PORT) out.port = Number(env.MYSQL_PORT);
  if (env.MYSQL_USER) out.user = env.MYSQL_USER;
  if (env.MYSQL_PASSWORD !== undefined) out.password = env.MYSQL_PASSWORD;
  if (env.MYSQL_DATABASE) out.database = env.MYSQL_DATABASE;
  return out;
}

export function mergeConfig(
  env: Partial<DBConfig>,
  overrides: ConfigOverrides,
): Partial<DBConfig> {
  return {
    host: overrides.host ?? env.host,
    port: overrides.port ?? env.port,
    user: overrides.user ?? env.user,
    password: overrides.password ?? env.password,
    database: overrides.database ?? env.database,
  };
}

export function isComplete(cfg: Partial<DBConfig>): cfg is DBConfig {
  return (
    typeof cfg.host === "string" &&
    typeof cfg.port === "number" &&
    !Number.isNaN(cfg.port) &&
    typeof cfg.user === "string" &&
    typeof cfg.password === "string" &&
    typeof cfg.database === "string" &&
    cfg.database.length > 0
  );
}

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (hidden) {
      const stdin = process.stdin;
      const onData = (char: Buffer) => {
        const s = char.toString("utf8");
        if (s === "\n" || s === "\r" || s === "\r\n" || s === "\u0004") {
          stdin.removeListener("data", onData);
        } else {
          process.stdout.write("*");
        }
      };
      stdin.on("data", onData);
    }

    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

export async function promptMissing(cfg: Partial<DBConfig>): Promise<DBConfig> {
  const host = cfg.host ?? ((await prompt("Host [localhost]: ")) || "localhost");
  const portStr = cfg.port?.toString() ?? ((await prompt("Port [3306]: ")) || "3306");
  const port = Number(portStr);
  const user = cfg.user ?? ((await prompt("User [root]: ")) || "root");
  const password = cfg.password ?? (await prompt("Password: ", true));
  const database = cfg.database ?? (await prompt("Database: "));

  if (!database) throw new Error("Database name is required");
  if (Number.isNaN(port)) throw new Error(`Invalid port: ${portStr}`);

  return { host, port, user, password, database };
}
