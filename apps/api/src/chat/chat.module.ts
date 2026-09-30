import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { NotesModule } from '../notes/notes.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [EmbeddingsModule, NotesModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
