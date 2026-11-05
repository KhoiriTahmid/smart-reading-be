import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { User } from 'src/decorators/user.decorator';
import { UserModel } from '../users/users.entity';
import {
  AuthTokensResponse,
  GoogleLoginRequest,
  LoginRequest,
  LogoutResponse,
  RedirectParam,
  RefreshTokenRequest,
  SignupRequest,
} from './auth.contract';
import { AuthService } from './auth.service';

const ACCESS_TOKEN_MAX_AGE = 1000 * 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: process.env.FRONTEND_DOMAIN || undefined,
  path: '/',
};

const redirectQuery = {
  name: 'isRedirect',
  required: false,
  schema: {
    type: 'boolean' as const,
    default: false,
  },
  description:
    'Set false to receive JSON instead of a 302 redirect. Swagger uses this to expose the tokens.',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ description: 'Current user profile' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async me(@User('userId') userId: string) {
    return await this.authService.me(userId);
  }

  @Post('signin-by-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Sets httpOnly access_token and refresh_token cookies. Pass isRedirect=false to receive the tokens in the response body.',
  })
  @ApiBody({ type: LoginRequest })
  @ApiQuery(redirectQuery)
  @ApiOkResponse({
    type: AuthTokensResponse,
    description: 'Returned when isRedirect=false.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description:
      'Redirects to the frontend dashboard when isRedirect is omitted or true.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async loginByEmail(
    @User() user: UserModel,
    @Query() query: RedirectParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse | void> {
    const tokens = await this.authService.loginByEmail(user);
    this.setAuthCookies(res, tokens);

    if (query.isRedirect === false) return tokens;

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }

  @Post('signup-by-email')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account with email and password',
    description:
      'Creates a user with the default user role, sets httpOnly access_token and refresh_token cookies, and returns the tokens.',
  })
  @ApiBody({ type: SignupRequest })
  @ApiCreatedResponse({
    type: AuthTokensResponse,
    description: 'Account created and authenticated.',
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async signupByEmail(
    @Body() body: SignupRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse> {
    const tokens = await this.authService.signupByEmail(body);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Get('signin-by-google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start the Google OAuth flow' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Google.',
  })
  googleLogin() {}

  @Get('signin-by-google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Sets auth cookies and redirects to the frontend. Pass isRedirect=false to receive the tokens in the response body.',
  })
  @ApiQuery(redirectQuery)
  @ApiOkResponse({
    type: AuthTokensResponse,
    description: 'Returned when isRedirect=false.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to the frontend dashboard by default.',
  })
  async loginByGoogle(
    @User() user: GoogleLoginRequest,
    @Query() query: RedirectParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse | void> {
    const tokens = await this.authService.loginOrRegisterByGoogle(user);
    this.setAuthCookies(res, tokens);

    if (query.isRedirect === false) return tokens;

    console.info('redirected----');
    return res.redirect(`${process.env.FRONTEND_URL}`);
  }

  @Get('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({
    summary: 'Refresh the access token',
    description:
      'Reads the httpOnly refresh_token cookie, rotates both tokens, and redirects to the frontend. Pass isRedirect=false to receive the tokens in the response body. If Swagger is authorized with the old access token, replace it with the new one.',
  })
  @ApiQuery(redirectQuery)
  @ApiOkResponse({
    type: AuthTokensResponse,
    description: 'Returned when isRedirect=false.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description:
      'Redirects to the frontend dashboard when isRedirect is omitted or true.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired refresh token.',
  })
  async refreshToken(
    @User() user: RefreshTokenRequest,
    @Query() query: RedirectParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponse | void> {
    const token = await this.authService.refreshToken(user);

    if ('needLogout' in token) {
      await this.authService.logout(user.userId);
      this.clearAuthCookies(res);

      if (query.isRedirect === false)
        throw new UnauthorizedException('Refresh token is invalid');

      return res.redirect(`${process.env.FRONTEND_URL}/logout`);
    }

    this.setAuthCookies(res, token);

    if (query.isRedirect === false) return token;

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }

  @Get('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out',
    description:
      'Clears the auth cookies and revokes the stored refresh token. Pass isRedirect=false to receive a JSON response.',
  })
  @ApiQuery(redirectQuery)
  @ApiOkResponse({
    type: LogoutResponse,
    description: 'Returned when isRedirect=false.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description:
      'Redirects to the frontend logout page when isRedirect is omitted or true.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @User('userId') userId: string,
    @Query() query: RedirectParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse | void> {
    await this.authService.logout(userId);
    this.clearAuthCookies(res);

    if (query.isRedirect === false) return { ok: true };

    return res.redirect(`${process.env.FRONTEND_URL}/logout`);
  }

  private setAuthCookies(
    res: Response,
    tokens: Pick<AuthTokensResponse, 'access_token' | 'refresh_token'>,
  ) {
    res.cookie('access_token', tokens.access_token, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }
}
