import { Controller, Post, Body, Get, UseGuards, Request, Logger } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("api/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body()
    body: {
      openId: string;
      name?: string;
      password?: string;
      role?: string;
      hospitalId?: number;
      email?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post("login")
  async login(@Body() body: { openId: string; password?: string }) {
    return this.authService.login(body.openId, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout() {
    return { success: true };
  }
}
