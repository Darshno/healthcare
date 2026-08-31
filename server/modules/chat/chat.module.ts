import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { execSync } from "child_process";
import { ChatMessage } from "../../database/entities";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatRealtimeService } from "./chat.realtime.service";

function isDatabaseReachable(): boolean {
  if (!process.env.DATABASE_URL) return false;
  try {
    const url = new URL(process.env.DATABASE_URL);
    const port = parseInt(url.port || "5432", 10);
    const host = url.hostname || "localhost";
    execSync(
      `node -e "require('net').createConnection(${port},'${host}').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"`,
      { timeout: 2000, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

const hasDb = isDatabaseReachable();

@Module({
  imports: hasDb ? [TypeOrmModule.forFeature([ChatMessage])] : [],
  providers: [ChatService, ChatRealtimeService],
  controllers: [ChatController],
  exports: [ChatService, ChatRealtimeService],
})
export class ChatModule {}

