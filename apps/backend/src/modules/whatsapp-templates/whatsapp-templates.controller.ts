import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { UpdateWhatsappTemplateDto } from './dto/update-whatsapp-template.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('whatsapp-templates')
export class WhatsappTemplatesController {
  constructor(private service: WhatsappTemplatesService) {}

  // Daftar 4 trigger sekaligus isi aktifnya (custom / default)
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':type')
  findOne(@Param('type') type: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(type, user);
  }

  @Put(':type')
  @Roles('super_admin', 'admin')
  update(
    @Param('type') type: string,
    @Body() dto: UpdateWhatsappTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.upsert(type, dto.content, user);
  }

  @Post(':type/reset')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  reset(@Param('type') type: string, @CurrentUser() user: AuthUser) {
    return this.service.reset(type, user);
  }
}
