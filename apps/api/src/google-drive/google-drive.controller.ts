import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  Body,
} from "@nestjs/common";
import type { Response } from "express";
import { GoogleDriveService } from "./google-drive.service";
import { Public } from "../auth/public.decorator";
import type { ApiResponse, GoogleDriveConnection } from "@interface/shared";

@Controller("google-drive")
export class GoogleDriveController {
  constructor(private readonly drive: GoogleDriveService) {}

  /* ------------------------------------------------------------------ */
  /*  OAuth flow                                                         */
  /* ------------------------------------------------------------------ */

  @Public()
  @Get("connect")
  connect(@Res() res: Response) {
    const url = this.drive.getAuthorizationUrl("google-drive");
    res.redirect(url);
  }

  @Public()
  @Get("callback")
  async callback(@Query("code") code: string, @Res() res: Response) {
    await this.drive.exchangeCode(code);
    const webUrl =
      process.env.API_URL?.replace("3001", "3000") ?? "http://localhost:3000";
    res.redirect(`${webUrl}/admin/integrations?gdrive=connected`);
  }

  @Get("status")
  async status(): Promise<ApiResponse<GoogleDriveConnection | null>> {
    return { data: await this.drive.getConnection() };
  }

  @Delete("disconnect")
  async disconnect(): Promise<void> {
    await this.drive.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /*  Folder management                                                  */
  /* ------------------------------------------------------------------ */

  @Get("folders")
  async listFolders(
    @Query("parentId") parentId?: string,
  ): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
    const data = await this.drive.listFolders(parentId || undefined);
    return { data };
  }

  @Post("root-folder")
  async setRootFolder(@Body() body: { folderId: string }): Promise<void> {
    await this.drive.setRootFolder(body.folderId);
  }
}
