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
import { IpPoolsService } from './ip-pools.service';
import { CreateIpPoolDto } from './dto/create-ip-pool.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('ip-pools')
export class IpPoolsController {
  constructor(private ipPoolsService: IpPoolsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateIpPoolDto, @CurrentUser() user: AuthUser) {
    return this.ipPoolsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.ipPoolsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ipPoolsService.findOne(id, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ipPoolsService.remove(id, user);
  }
}