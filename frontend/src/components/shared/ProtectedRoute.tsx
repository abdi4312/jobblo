import { useUserStore } from "../../stores/userStore.ts";
import { type ReactNode, useEffect, useState } from "react";
import { Modal } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [modalText, setModalText] = useState("Du må logge inn først.");
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuth) {
      setOpen(true);
    }
  }, [isAuth]);

  function handleOk() {
    setModalText("Beep boop later som jeg logger inn om 2 sek");
    setConfirmLoading(true);

    setOpen(false);
    setConfirmLoading(false);
    navigate("/login", { state: { from: location } });
  }

  function handleCancel() {
    setOpen(false);
    navigate(-1);
  }

  if (!isAuth) {
    return (
      <>
        <Modal
          title={"Oops"}
          open={open}
          onOk={handleOk}
          confirmLoading={confirmLoading}
          onCancel={handleCancel}
          okText={"Logg inn"}
          cancelText={"Avbryt"}
        >
          <p>{modalText}</p>
        </Modal>
      </>
    );
  }
  return <>{children};</>;
}
