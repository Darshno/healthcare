import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatMessages1764000000000 implements MigrationInterface {
  name = "AddChatMessages1764000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" SERIAL NOT NULL,
        "channel" character varying(64) NOT NULL,
        "senderId" character varying(64) NOT NULL,
        "senderName" character varying(255) NOT NULL,
        "senderRole" character varying(128),
        "senderInitials" character varying(16) NOT NULL,
        "text" text NOT NULL,
        "tag" character varying(16),
        "sentAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_messages_channel_sentAt" ON "chat_messages" ("channel", "sentAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_channel_sentAt"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
  }
}
