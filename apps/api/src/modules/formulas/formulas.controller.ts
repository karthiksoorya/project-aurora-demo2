import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { badRequest } from '../../common/errors';
import { UUID_RE } from '../../common/ids';
import { BranchDto, CreateVersionDto, RevisionDto, UpdateDraftDto } from './formula.dto';
import { FormulasService } from './formulas.service';

const uuid = new ParseUUIDPipe({ version: undefined });

@Controller()
export class FormulasController {
  constructor(private readonly svc: FormulasService) {}

  @Get('projects/:projectId/formula-draft')
  getDraft(@Param('projectId', uuid) projectId: string) {
    return this.svc.getDraft(projectId);
  }

  @Put('projects/:projectId/formula-draft')
  updateDraft(@Param('projectId', uuid) projectId: string, @Body() dto: UpdateDraftDto) {
    return this.svc.updateDraft(projectId, dto);
  }

  /** Explicit, user-initiated normalisation to 100 %. Never applied implicitly. */
  @Post('projects/:projectId/formula-draft/normalize')
  @HttpCode(200)
  normalize(@Param('projectId', uuid) projectId: string, @Body() dto: RevisionDto) {
    return this.svc.normalizeDraft(projectId, dto.revision);
  }

  @Post('projects/:projectId/formula-versions')
  createVersion(@Param('projectId', uuid) projectId: string, @Body() dto: CreateVersionDto) {
    return this.svc.createVersion(projectId, dto);
  }

  @Get('projects/:projectId/formula-versions')
  listVersions(@Param('projectId', uuid) projectId: string) {
    return this.svc.listVersions(projectId);
  }

  // declared before :versionId so "compare" is not captured as an id
  @Get('formula-versions/compare')
  compare(@Query('leftId') leftId: string, @Query('rightId') rightId: string) {
    if (!UUID_RE.test(leftId ?? '') || !UUID_RE.test(rightId ?? ''))
      throw badRequest('leftId and rightId must be version UUIDs');
    return this.svc.compare(leftId, rightId);
  }

  @Get('formula-versions/:versionId')
  getVersion(@Param('versionId', uuid) versionId: string) {
    return this.svc.getVersion(versionId);
  }

  @Post('formula-versions/:versionId/branch')
  @HttpCode(200)
  branch(@Param('versionId', uuid) versionId: string, @Body() dto: BranchDto) {
    return this.svc.branch(versionId, dto?.expectedDraftRevision);
  }
}
