import * as React from "react";
import { Formik, FormikHelpers } from "formik";
import { CREATE_CITIZEN_SCHEMA } from "@snailycad/schemas";
import { useRouter } from "next/router";
import { useTranslations } from "use-intl";
import Link from "next/link";
import Head from "next/head";

import { Button } from "components/Button";
import { FormRow } from "components/form/FormRow";
import { FormField } from "components/form/FormField";
import { Input } from "components/form/Input";
import { Layout } from "components/Layout";
import { Loader } from "components/Loader";
import { handleValidate } from "lib/handleValidate";
import useFetch from "lib/useFetch";
import { GetServerSideProps } from "next";
import { getSessionUser } from "lib/auth";
import { getTranslations } from "lib/getTranslation";
import { Select } from "components/form/Select";
import { useCitizen } from "context/CitizenContext";
import { AllowedFileExtension, allowedFileExtensions } from "@snailycad/config";
import { useValues } from "context/ValuesContext";
import { requestAll } from "lib/utils";
import { useAuth } from "context/AuthContext";
import { CropImageModal } from "components/modal/CropImageModal";
import { useModal } from "context/ModalContext";
import { ModalIds } from "types/ModalIds";

export default function EditCitizen() {
  const [image, setImage] = React.useState<File | null>(null);

  const { openModal, isOpen, closeModal } = useModal();
  const { state, execute } = useFetch();
  const router = useRouter();
  const t = useTranslations("Citizen");
  const common = useTranslations("Common");
  const { cad } = useAuth();

  const { citizen } = useCitizen();
  const { gender, ethnicity } = useValues();

  if (!citizen) {
    return null;
  }

  const INITIAL_VALUES = {
    name: citizen.name,
    surname: citizen.surname,
    dateOfBirth: citizen.dateOfBirth,
    gender: citizen.genderId,
    ethnicity: citizen.ethnicityId,
    weight: citizen.weight,
    height: citizen.height,
    hairColor: citizen.hairColor,
    eyeColor: citizen.eyeColor,
    address: citizen.address,
    image: undefined,
    phoneNumber: citizen.phoneNumber,
  };

  function onCropSuccess(url: Blob, filename: string) {
    setImage(new File([url], filename, { type: url.type }));
    closeModal(ModalIds.CropImageModal);
  }

  async function onSubmit(
    values: typeof INITIAL_VALUES,
    helpers: FormikHelpers<typeof INITIAL_VALUES>,
  ) {
    if (!citizen) return;

    const fd = new FormData();
    if (image && image.size && image.name) {
      if (!allowedFileExtensions.includes(image.type as AllowedFileExtension)) {
        helpers.setFieldError("image", `Only ${allowedFileExtensions.join(", ")} are supported`);
        return;
      }

      fd.set("image", image, image.name);
    }

    const { json } = await execute(`/citizen/${citizen.id}`, {
      method: "PUT",
      data: values,
    });

    if (image && image.size && image.name) {
      await execute(`/citizen/${citizen.id}`, {
        method: "POST",
        data: fd,
      });
    }

    if (json?.id) {
      router.push(`/citizen/${json.id}`);
    }
  }

  const validate = handleValidate(CREATE_CITIZEN_SCHEMA);

  const weightPrefix = cad?.miscCadSettings?.weightPrefix
    ? `(${cad?.miscCadSettings.weightPrefix})`
    : "";

  const heightPrefix = cad?.miscCadSettings?.heightPrefix
    ? `(${cad?.miscCadSettings.heightPrefix})`
    : "";

  return (
    <Layout className="dark:text-white">
      <Head>
        <title>
          {t("editCitizen")} - {citizen.name} {citizen.surname}
        </title>
      </Head>
      <h1 className="mb-3 text-3xl font-semibold">{t("editCitizen")}</h1>

      <Formik validate={validate} onSubmit={onSubmit} initialValues={INITIAL_VALUES}>
        {({ handleSubmit, handleChange, setFieldValue, values, errors, isValid }) => (
          <form onSubmit={handleSubmit}>
            <FormField optional errorMessage={errors.image} label={t("image")}>
              <div className="flex">
                <Input
                  style={{ width: "95%", marginRight: "0.5em" }}
                  onChange={(e) => {
                    handleChange(e);
                    setImage(e.target.files?.[0] ?? null);
                  }}
                  type="file"
                  name="image"
                  value={values.image ?? ""}
                />
                <Button
                  className="mr-2"
                  type="button"
                  onClick={() => {
                    openModal(ModalIds.CropImageModal);
                  }}
                >
                  Crop
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setFieldValue("image", "");
                  }}
                >
                  {common("delete")}
                </Button>
              </div>
            </FormField>

            <FormRow>
              <FormField errorMessage={errors.name} label={t("name")}>
                <Input value={values.name} onChange={handleChange} name="name" disabled />
              </FormField>

              <FormField errorMessage={errors.surname} label={t("surname")}>
                <Input value={values.surname} onChange={handleChange} name="surname" disabled />
              </FormField>
            </FormRow>

            <FormField errorMessage={errors.dateOfBirth as string} label={t("dateOfBirth")}>
              <Input
                type="date"
                value={new Date(values.dateOfBirth.toString()).toISOString().slice(0, 10)}
                onChange={(e) =>
                  handleChange({
                    ...e,
                    target: { name: "dateOfBirth", value: e.target.valueAsDate },
                  })
                }
                name="dateOfBirth"
              />
            </FormField>

            <FormRow>
              <FormField errorMessage={errors.gender} label={t("gender")}>
                <Select
                  name="gender"
                  value={values.gender}
                  onChange={handleChange}
                  values={gender.values.map((gender) => ({
                    label: gender.value,
                    value: gender.id,
                  }))}
                />
              </FormField>

              <FormField errorMessage={errors.ethnicity} label={t("ethnicity")}>
                <Select
                  name="ethnicity"
                  value={values.ethnicity}
                  onChange={handleChange}
                  values={ethnicity.values.map((ethnicity) => ({
                    label: ethnicity.value,
                    value: ethnicity.id,
                  }))}
                />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField errorMessage={errors.hairColor} label={t("eyeColor")}>
                <Input value={values.eyeColor} onChange={handleChange} name="hairColor" />
              </FormField>

              <FormField errorMessage={errors.eyeColor} label={t("hairColor")}>
                <Input value={values.hairColor} onChange={handleChange} name="eyeColor" />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField errorMessage={errors.weight} label={`${t("weight")} ${weightPrefix}`}>
                <Input value={values.weight} onChange={handleChange} name="weight" />
              </FormField>

              <FormField errorMessage={errors.height} label={`${t("height")} ${heightPrefix}`}>
                <Input value={values.height} onChange={handleChange} name="height" />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField errorMessage={errors.address} label={t("address")}>
                <Input value={values.address} onChange={handleChange} name="address" />
              </FormField>

              <FormField optional errorMessage={errors.phoneNumber} label={t("phoneNumber")}>
                <Input
                  value={values.phoneNumber ?? ""}
                  onChange={handleChange}
                  name="phoneNumber"
                />
              </FormField>
            </FormRow>

            <div className="flex items-center justify-end">
              <Link href={`/citizen/${citizen.id}`}>
                <a className="mr-2 underline">{common("cancel")}</a>
              </Link>

              <Button
                className="flex items-center gap-2"
                type="submit"
                disabled={!isValid || state === "loading"}
              >
                {state === "loading" ? <Loader /> : null} {common("save")}
              </Button>
            </div>

            <CropImageModal
              isOpen={isOpen(ModalIds.CropImageModal)}
              onClose={() => closeModal(ModalIds.CropImageModal)}
              image={image}
              onSuccess={onCropSuccess}
            />
          </form>
        )}
      </Formik>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ query, locale, req }) => {
  const [data, values] = await requestAll(req, [
    [`/citizen/${query.id}`, null],
    ["/admin/values/gender?paths=ethnicity", []],
  ]);

  if (!data) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      values,
      citizen: data,
      session: await getSessionUser(req),
      messages: {
        ...(await getTranslations(["citizen", "common"], locale)),
      },
    },
  };
};
