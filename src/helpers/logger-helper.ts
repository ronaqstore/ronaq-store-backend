const ERROR_BEGIN = '\n========== ERROR BEGIN ==========';
const ERROR_END = '==========  ERROR END  ==========\n';

const isJest = typeof process['env']?.JEST_WORKER_ID !== 'undefined';

export const logError = (
  fileName: string,
  functionName: string,
  error: unknown,
  additionalInformation: Record<string, unknown> = {},
): void => {
  if (isJest) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const lines = [
    ERROR_BEGIN,
    `File     : ${fileName}`,
    `Function : ${functionName}`,
    `Message  : ${errorMessage}`,
    Object.keys(additionalInformation).length > 0
      ? `Context  : ${JSON.stringify(additionalInformation)}`
      : null,
    errorStack ? `Stack    : ${errorStack}` : null,
    ERROR_END,
  ].filter(Boolean) as string[];

  console.error(lines.join('\n'));
};

export const logInfo = (
  fileName: string,
  functionName: string,
  message: string,
  additionalInformation: Record<string, unknown> = {},
): void => {
  if (isJest) return;

  const context =
    Object.keys(additionalInformation).length > 0
      ? ` | ${JSON.stringify(additionalInformation)}`
      : '';

  console.log(`[${fileName}:${functionName}] ${message}${context}`);
};
