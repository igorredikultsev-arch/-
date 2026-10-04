import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { SubHead } from "../../ui";
import { PasswordForm } from "../password-form";

export default async function PasswordPage() {
  const { asAdmin } = await requireOwner();
  if (asAdmin) redirect("/cabinet/more");
  return (
    <>
      <SubHead back="/cabinet/more" backLabel="Ещё" title="Сменить пароль">
        После смены пароля на других телефонах и компьютерах нужно будет войти заново.
      </SubHead>
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <PasswordForm />
      </div>
    </>
  );
}
