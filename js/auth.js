/**
 * Módulo de Autenticación y Control de Acceso Basado en Roles (RBAC)
 * Operatividad 100% Offline-First para validación de perfiles en terreno.
 */
class AuthService {
  constructor() {
    this.STORAGE_KEY = 'agrobitacora_active_session';
    
    // Perfiles y Credenciales oficiales según rúbrica
    this.USERS = [
      {
        email: 'supervisor@agrobitacora.local',
        password: 'CampoSeguro2026!',
        name: 'Ing. Carlos Mendoza',
        role: 'supervisor',
        roleLabel: 'Agrónomo Supervisor',
        badgeClass: 'badge-supervisor',
        permissions: {
          canCreate: true,
          canDelete: true,
          canExport: true,
          canAudit: true
        }
      },
      {
        email: 'tecnico.campo@agrobitacora.local',
        password: 'SiembraOffline#1',
        name: 'Téc. Sofía Valenzuela',
        role: 'tecnico',
        roleLabel: 'Técnico de Terreno',
        badgeClass: 'badge-tecnico',
        permissions: {
          canCreate: true,
          canDelete: false, // No puede eliminar evidencias en campo
          canExport: false,
          canAudit: false
        }
      },
      {
        email: 'auditor.sag@agrobitacora.local',
        password: 'ControlPlagas2026',
        name: 'Dra. Elena Morales',
        role: 'auditor',
        roleLabel: 'Auditor Fitosanitario',
        badgeClass: 'badge-auditor',
        permissions: {
          canCreate: false, // Modo solo lectura
          canDelete: false,
          canExport: true,  // Exportar reportes de trazabilidad
          canAudit: true
        }
      }
    ];

    this.currentUser = this.loadSession();
  }

  // Cargar sesión persistida localmente (mantiene la sesión incluso offline o tras recarga)
  loadSession() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('[Auth] No se pudo leer la sesión local:', e);
      return null;
    }
  }

  // Inicio de sesión con verificación local offline
  login(email, password) {
    const user = this.USERS.find(
      (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === password
    );

    if (!user) {
      throw new Error('Credenciales incorrectas. Verifique el usuario y la contraseña.');
    }

    // Copia segura de la sesión sin exponer la contraseña
    const sessionUser = {
      email: user.email,
      name: user.name,
      role: user.role,
      roleLabel: user.roleLabel,
      badgeClass: user.badgeClass,
      permissions: user.permissions
    };

    this.currentUser = sessionUser;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  }

  // Cierre de sesión
  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Consultar estado de autenticación
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Obtener usuario activo
  getCurrentUser() {
    return this.currentUser;
  }

  // Validar permiso específico
  hasPermission(permissionName) {
    if (!this.currentUser || !this.currentUser.permissions) return false;
    return !!this.currentUser.permissions[permissionName];
  }
}

// Instancia global
window.authService = new AuthService();
