import { ValueType } from ".prisma/client";
import { CREATE_PENAL_CODE_SCHEMA, validate, VALUE_SCHEMA } from "@snailycad/schemas";
import {
  Get,
  Controller,
  PathParams,
  UseBeforeEach,
  UseBefore,
  BodyParams,
  QueryParams,
} from "@tsed/common";
import { Delete, JsonRequestBody, Patch, Post } from "@tsed/schema";
import { prisma } from "../../lib/prisma";
import { IsAdmin } from "../../middlewares/Permissions";
import { IsValidPath } from "../../middlewares/ValidPath";
import { BadRequest } from "@tsed/exceptions";

@Controller("/admin/values/:path")
@UseBeforeEach(IsValidPath)
export class ValuesController {
  @Get("/")
  async getValueByPath(@PathParams("path") path: string, @QueryParams("paths") rawPaths: string) {
    // allow more paths in one request
    const paths =
      typeof rawPaths === "string" ? [...new Set([path, ...rawPaths.split(",")])] : [path];

    const values = await Promise.all(
      paths.map(async (path) => {
        const type = this.getTypeFromPath(path);

        if (type === "PENAL_CODE") {
          return {
            type,
            values: await prisma.penalCode.findMany(),
          };
        }

        if (type === "BUSINESS_ROLE") {
          return {
            type,
            values: await prisma.employeeValue.findMany({
              include: {
                value: true,
              },
            }),
          };
        }

        if (type === "CODES_10") {
          return {
            type,
            values: await prisma.statusValue.findMany({
              include: {
                value: true,
              },
            }),
          };
        }

        if (type === "DIVISION") {
          return {
            type,
            values: await prisma.divisionValue.findMany({
              include: {
                value: true,
                department: true,
              },
            }),
          };
        }

        return {
          type,
          values: await prisma.value.findMany({
            where: {
              type,
            },
          }),
        };
      }),
    );

    return values;
  }

  @UseBefore(IsAdmin)
  @Post("/")
  async createValueByPath(@BodyParams() body: JsonRequestBody, @PathParams("path") path: string) {
    const type = this.getTypeFromPath(path);

    if (type === "PENAL_CODE") {
      const error = validate(CREATE_PENAL_CODE_SCHEMA, body.toJSON(), true);

      if (error) {
        throw new BadRequest(error);
      }

      const code = await prisma.penalCode.create({
        data: {
          title: body.get("title"),
          description: body.get("description"),
        },
      });

      return code;
    }

    const error = validate(VALUE_SCHEMA, body.toJSON(), true);

    if (error) {
      throw new BadRequest(error);
    }

    const value = await prisma.value.create({
      data: {
        type,
        value: body.get("value"),
        isDefault: false,
      },
    });

    if (type === "CODES_10") {
      if (!body.get("shouldDo")) {
        throw new BadRequest("codes10FieldsRequired");
      }

      const status = await prisma.statusValue.create({
        data: {
          whatPages: body.get("whatPages") ?? [],
          shouldDo: body.get("shouldDo"),
          valueId: value.id,
          position: Number(body.get("position")),
        },
        include: {
          value: true,
        },
      });

      return status;
    }

    if (type === "BUSINESS_ROLE") {
      if (!body.get("as")) {
        throw new BadRequest("asRequired");
      }

      await prisma.employeeValue.create({
        data: {
          as: body.get("as"),
          valueId: value.id,
        },
      });
    }

    if (type === "DIVISION") {
      if (!body.get("departmentId")) {
        throw new BadRequest("departmentIdRequired");
      }

      await prisma.divisionValue.create({
        data: {
          valueId: value.id,
          departmentId: body.get("departmentId"),
        },
        include: {
          value: true,
          department: true,
        },
      });
    }

    return value;
  }

  @UseBefore(IsAdmin)
  @Delete("/:id")
  async deleteValueByPathAndId(@PathParams("id") id: string, @PathParams("path") path: string) {
    const type = this.getTypeFromPath(path);

    if (type === "CODES_10") {
      await prisma.statusValue.delete({
        where: {
          id,
        },
      });

      return true;
    }

    if (type === "PENAL_CODE") {
      await prisma.penalCode.delete({
        where: {
          id,
        },
      });

      return true;
    }

    if (type === "DIVISION") {
      await prisma.divisionValue.delete({
        where: {
          id,
        },
      });

      return true;
    }

    await prisma.value.delete({
      where: {
        id,
      },
    });

    return true;
  }

  @UseBefore(IsAdmin)
  @Patch("/:id")
  async patchValueByPathAndId(
    @BodyParams() body: JsonRequestBody,
    @PathParams("id") id: string,
    @PathParams("path") path: string,
  ) {
    const error = validate(VALUE_SCHEMA, body.toJSON(), true);
    const type = this.getTypeFromPath(path);

    if (error) {
      return { error };
    }

    if (type === "CODES_10") {
      const updated = await prisma.statusValue.update({
        where: {
          id,
        },
        data: {
          value: {
            update: {
              value: body.get("value"),
            },
          },
          whatPages: body.get("whatPages") ?? [],
          shouldDo: body.get("shouldDo"),
          position: Number(body.get("position")),
        },
        include: {
          value: true,
        },
      });

      return updated;
    }

    if (type === "DIVISION") {
      if (!body.get("departmentId")) {
        throw new BadRequest("departmentIdRequired");
      }

      const updated = await prisma.divisionValue.update({
        where: {
          id,
        },
        data: {
          value: {
            update: {
              value: body.get("value"),
            },
          },
        },
        include: {
          value: true,
          department: true,
        },
      });

      const value = await prisma.value.findUnique({
        where: {
          id: updated.valueId,
        },
      });

      return value;
    }

    const updated = await prisma.value.update({
      where: {
        id,
      },
      data: {
        value: body.get("value"),
      },
    });

    return updated;
  }

  private getTypeFromPath(path: string): ValueType {
    return path.replace("-", "_").toUpperCase() as ValueType;
  }
}