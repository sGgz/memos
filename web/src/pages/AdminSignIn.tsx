import AuthFooter from "@/components/AuthFooter";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { useInstance } from "@/contexts/InstanceContext";

const AdminSignIn = () => {
  const { generalSetting: instanceGeneralSetting } = useInstance();

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-col items-center mb-6">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
            <img className="h-14 w-auto rounded-full shadow" src={instanceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
            <div className="flex flex-col items-center sm:ml-3 sm:items-start">
              <p className="text-4xl sm:text-5xl text-foreground/90">{instanceGeneralSetting.customProfile?.title || "Memos"}</p>
              <span className="mt-2 inline-flex items-center rounded-full border border-border/60 bg-gradient-to-r from-card/90 via-card/70 to-card/80 px-3 py-1 text-xs font-medium text-foreground/80 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                个人备忘录
              </span>
            </div>
          </div>
        </div>
        <p className="w-full text-xl font-medium text-muted-foreground">Sign in with admin accounts</p>
        <PasswordSignInForm />
      </div>
      <AuthFooter />
    </div>
  );
};

export default AdminSignIn;
