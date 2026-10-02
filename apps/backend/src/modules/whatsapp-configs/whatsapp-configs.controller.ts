import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WhatsappConfigsService } from './whatsapp-configs.service';
import { CreateWhatsappConfigDto } from './dto/create-whatsapp-config.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('whatsapp-configs')
export class WhatsappConfigsController {
  constructor(private service: WhatsappConfigsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateWhatsappConfigDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('super_admin', 'admin')
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Post(':id/test')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  testSend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.testSend(id, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remove(id, user);
  }
}