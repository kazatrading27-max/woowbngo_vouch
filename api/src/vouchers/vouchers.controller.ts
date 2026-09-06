import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { VouchersService } from './vouchers.service';
import { CreateVouchersDto, ValidateVoucherDto, ListVouchersQueryDto } from './vouchers.dto';

@Controller('vouchers')
export class VouchersController {
  constructor(private vouchers: VouchersService) {}

  @Get()
  list(@Query() query: ListVouchersQueryDto) {
    return this.vouchers.list(query);
  }

  @Get('stats')
  stats(@Query('stationId') stationId?: string) {
    return this.vouchers.stats(stationId || undefined);
  }

  @Post('validate')
  validate(@Body() dto: ValidateVoucherDto) {
    return this.vouchers.validate(dto);
  }

  @Post()
  create(@Body() dto: CreateVouchersDto, @CurrentUser() actor: AuthUser) {
    return this.vouchers.create(dto, actor);
  }

  @Post(':id/redeem')
  markRedeemed(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.vouchers.markRedeemed(id, actor);
  }

  @Post(':id/revoke')
  @Roles('ADMIN')
  revoke(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.vouchers.revoke(id, actor);
  }
}
