import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

type JsonMock = jest.Mock<void, [unknown]>;
type StatusMock = jest.Mock<{ json: JsonMock }, [number]>;

const createHost = (): {
  host: ArgumentsHost;
  status: StatusMock;
  json: JsonMock;
} => {
  const json: JsonMock = jest.fn<void, [unknown]>();
  const status: StatusMock = jest.fn<{ json: JsonMock }, [number]>(() => ({
    json
  }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status
      })
    })
  } as unknown as ArgumentsHost;

  return { host, status, json };
};

describe("HttpExceptionFilter", () => {
  it("wraps not found errors in the standard error envelope", () => {
    const { host, status, json } = createHost();

    new HttpExceptionFilter().catch(new NotFoundException("Tenant not found"), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Tenant not found"
      }
    });
  });

  it("moves validation messages into details", () => {
    const { host, status, json } = createHost();

    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: ["email must be an email"],
        error: "Bad Request",
        statusCode: 400
      }),
      host
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Bad Request",
        details: ["email must be an email"]
      }
    });
  });

  it("preserves custom application error codes", () => {
    const { host, status, json } = createHost();

    new HttpExceptionFilter().catch(
      new ForbiddenException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "Workspace limit exceeded"
      }),
      host
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "PLAN_LIMIT_EXCEEDED",
        message: "Workspace limit exceeded"
      }
    });
  });
});
