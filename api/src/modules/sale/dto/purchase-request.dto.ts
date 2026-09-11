import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeUserId } from '../utils/user-id.util';

export class PurchaseRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeUserId(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  userId: string;
}
