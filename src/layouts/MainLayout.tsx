import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Bot, MessageSquare, Clock, Settings } from "lucide-react";
import { useGatewayStore } from "@/stores/gateway-store";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { name: "Agents", path: "/agents", icon: Bot },
  { name: "Chat", path: "/chat", icon: MessageSquare },
  { name: "Cron", path: "/cron", icon: Clock },
  { name: "Config", path: "/config", icon: Settings },
];

export function MainLayout() {
  const { status, init } = useGatewayStore();

  useEffect(() => {
    init();
  }, [init]);

  const statusColor = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    reconnecting: "bg-yellow-500",
    disconnected: "bg-red-500",
  }[status];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-lg">OpenClaw</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
              {status}
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          isActive ? "bg-accent text-accent-foreground" : ""
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-4 border-b bg-background px-4 lg:hidden">
          <SidebarTrigger />
          <span className="font-semibold text-lg">OpenClaw</span>
        </header>
        {status !== "connected" && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            {status === "connecting" && "Connecting to Gateway..."}
            {status === "reconnecting" && "Reconnecting to Gateway..."}
            {status === "disconnected" && "Gateway disconnected. Actions are disabled until reconnected."}
          </div>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}