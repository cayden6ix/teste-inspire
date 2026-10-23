import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  RateLimitScope,
  ThrottleScope,
} from '../../../common/decorators/throttle-scope.decorator.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { AuthService } from '../services/auth.service.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimitScope(ThrottleScope.Register)
  @ApiCreatedResponse({ type: AuthResponseDto, description: 'Usuario criado e token emitido' })
  @ApiErrorResponses(400, 409, 429)
  @ApiOperation({ summary: 'Cria uma conta e devolve o token de acesso' })
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  // Login nao cria recurso: 200, como no contrato (o @Post do Nest responderia 201).
  @HttpCode(HttpStatus.OK)
  @RateLimitScope(ThrottleScope.Login)
  @ApiOkResponse({ type: AuthResponseDto, description: 'Credenciais validas; token emitido' })
  @ApiErrorResponses(400, 401, 429)
  @ApiOperation({ summary: 'Autentica com email e senha e devolve o token de acesso' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
