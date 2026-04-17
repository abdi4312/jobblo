import React from "react";
import { useUserStore } from "../../../stores/userStore";
import { NotificationToggle } from "../NotificationToggle/NotificationToggle";
import { Bell, Mail, Smartphone, Volume2 } from "lucide-react";

export function NotificationManager() {
  const {
    notificationsEnabled,
    browserNotificationsEnabled,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    setNotificationsEnabled,
    setBrowserNotificationsEnabled,
    setEmailNotificationsEnabled,
    setSmsNotificationsEnabled,
  } = useUserStore();

  const handleBrowserToggle = async (enabled: boolean) => {
    if (enabled) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setBrowserNotificationsEnabled(true);
      } else {
        alert(
          "Du må tillate varsler i nettleseren for å aktivere denne funksjonen.",
        );
        setBrowserNotificationsEnabled(false);
      }
    } else {
      setBrowserNotificationsEnabled(false);
    }
  };

  const sendTestNotification = () => {
    if (!browserNotificationsEnabled) {
      alert("Aktiver nettleservarsler først!");
      return;
    }

    if (Notification.permission !== "granted") {
      alert("Du har ikke gitt tillatelse til varsler i nettleseren.");
      return;
    }

    alert(
      "Test-varsel sendes om 5 sekunder. Bytt fane eller minimer nettleseren nå!",
    );

    setTimeout(() => {
      try {
        console.log("Attempting to send notification...");
        const notification = new Notification("Test fra Jobblo", {
          body: "Dette er et testvarsel for å se om bakgrunnsvarsler fungerer!",
          // icon: "/logo192.png",
          requireInteraction: true, // Desktop par notification rukega jab tak click na ho
          silent: false,
        });

        notification.onclick = () => {
          console.log("Notification clicked!");
          window.focus();
        };

        notification.onerror = (err) => {
          console.error("Notification error:", err);
          alert("Notification error: " + JSON.stringify(err));
        };
      } catch (err) {
        console.error("Catch error sending notification:", err);
        alert("Catch error: " + err);
      }
    }, 5000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
        <div className="p-3 bg-green-50 rounded-xl">
          <Bell className="text-[#2F7E47]" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Varslingsinnstillinger
          </h2>
          <p className="text-sm text-gray-500">
            Velg hvordan du vil motta oppdateringer
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Sound Notifications */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
              <Volume2 size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Varsellyd</p>
              <p className="text-xs text-gray-500">
                Spill av lyd ved nye meldinger
              </p>
            </div>
          </div>
          <NotificationToggle
            enabled={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
        </div>

        {/* Browser Push Notifications */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
              <Bell size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Nettleservarsler</p>
              <p className="text-xs text-gray-500">
                Vis varsler selv når fanen er i bakgrunnen
              </p>
            </div>
          </div>
          <NotificationToggle
            enabled={browserNotificationsEnabled}
            onChange={handleBrowserToggle}
          />
        </div>

        {/* Email Notifications */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
              <Mail size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">E-post varsler</p>
              <p className="text-xs text-gray-500">
                Motta viktige oppdateringer på e-post
              </p>
            </div>
          </div>
          <NotificationToggle
            enabled={emailNotificationsEnabled}
            onChange={setEmailNotificationsEnabled}
          />
        </div>

        {/* SMS Notifications */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
              <Smartphone size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">SMS varsler</p>
              <p className="text-xs text-gray-500">
                Motta varsler direkte på din mobil
              </p>
            </div>
          </div>
          <NotificationToggle
            enabled={smsNotificationsEnabled}
            onChange={setSmsNotificationsEnabled}
          />
        </div>
      </div>

      <div className="mt-10 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed mb-4">
          <strong>Tips:</strong> For å motta varsler når nettleseren er lukket,
          må du aktivere "Nettleservarsler" og gi tillatelse når du blir spurt.
        </p>
        <button
          onClick={sendTestNotification}
          className="w-full py-2.5 px-4 bg-[#2F7E47] text-white text-sm font-bold rounded-lg hover:bg-[#2F7E47] transition-colors"
        >
          Send test-varsel (Bytt fane etterpå)
        </button>
      </div>
    </div>
  );
}
