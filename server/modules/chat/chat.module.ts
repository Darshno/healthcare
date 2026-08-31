import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ChatMessage } from "../../database/entities";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatRealtimeService } from "./chat.realtime.service";

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  providers: [ChatService, ChatRealtimeService],
  controllers: [ChatController],
  exports: [ChatService, ChatRealtimeService],
})
export class ChatModule {}
