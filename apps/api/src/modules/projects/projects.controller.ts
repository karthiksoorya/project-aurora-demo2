import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CreateProjectDto, UpdateBriefDto } from './projects.dto';
import { ProjectsService, UPLOAD_MAX_BYTES } from './projects.service';

const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get('projects')
  list() {
    return this.svc.list();
  }

  @Post('projects')
  create(@Body() dto: CreateProjectDto) {
    return this.svc.create(dto);
  }

  @Get('projects/:projectId')
  get(@Param('projectId', uuid) id: string) {
    return this.svc.get(id);
  }

  @Get('projects/:projectId/brief')
  getBrief(@Param('projectId', uuid) id: string) {
    return this.svc.getBrief(id);
  }

  @Put('projects/:projectId/brief')
  updateBrief(@Param('projectId', uuid) id: string, @Body() dto: UpdateBriefDto) {
    return this.svc.updateBrief(id, dto);
  }

  @Post('projects/:projectId/uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } }))
  upload(@Param('projectId', uuid) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.svc.addUpload(id, file);
  }

  @Get('uploads/:uploadId')
  async serveUpload(@Param('uploadId', uuid) id: string, @Res() res: Response) {
    const { upload, file } = await this.svc.getUpload(id);
    res.setHeader('Content-Type', upload.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(upload.originalName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(file);
  }

  @Get('projects/:projectId/audit')
  audit(@Param('projectId', uuid) id: string, @Query('limit') limit?: string) {
    return this.svc.audit(id, Number(limit ?? 50) || 50);
  }
}
