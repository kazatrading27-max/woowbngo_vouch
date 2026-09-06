import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { StationsService } from './stations.service';
import { CreateStationDto, UpdateStationDto } from './stations.dto';

@Controller('stations')
export class StationsController {
  constructor(private stations: StationsService) {}

  @Get()
  list() {
    return this.stations.list();
  }

  @Post()
  create(@Body() dto: CreateStationDto, @CurrentUser() actor: AuthUser) {
    return this.stations.create(dto, actor);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateStationDto, @CurrentUser() actor: AuthUser) {
    return this.stations.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.stations.remove(id, actor);
  }
}
