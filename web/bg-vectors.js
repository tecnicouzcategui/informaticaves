// ============================================================
// bg-vectors.js — Canvas de Vectores IT Flotantes en Fondo
// Informáticos Venezuela | Red Profesional de Técnicos IT
// ============================================================

(function () {
  'use strict';

  // Colección de 48 vectores precisos de Informática, Redes, Hardware y Telecomunicaciones
  // Normalizados para un viewBox de 24x24
  const VECTOR_PATHS = {
    // 1. CPU / Microprocesador
    cpu: new Path2D('M4 4h16v16H4V4zm4 4h8v8H8V8zM1 7h3v2H1V7zm0 4h3v2H1v-2zm0 4h3v2H1v-2zm20-8h3v2h-3V7zm0 4h3v2h-3v-2zm0 4h3v2h-3v-2zM7 1h2v3H7V1zm4 0h2v3h-2V1zm4 0h2v3h-2V1zM7 20h2v3H7v-3zm4 0h2v3h-2v-3zm4 0h2v3h-2v-3z'),
    
    // 2. Laptop
    laptop: new Path2D('M4 5h16a1 1 0 0 1 1 1v10H3V6a1 1 0 0 1 1-1zm1 2v7h14V7H5zm-4 10h22v2H1v-2zm8 0v1h6v-1H9z'),
    
    // 3. Monitor / Workstation
    monitor: new Path2D('M2 4h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7v2h3v2H6v-2h3v-2H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v10h18V6H3z'),
    
    // 4. Servidor Rack / Blade Server
    server: new Path2D('M2 3h20v5H2V3zm2 2v1h2V5H4zm4 0v1h1V5H8zm12 0v1h1V5h-1zM2 10h20v5H2v-5zm2 2v1h2v-1H4zm4 0v1h1v-1H8zm12 0v1h1v-1h-1zM2 17h20v5H2v-5zm2 2v1h2v-1H4zm4 0v1h1v-1H8zm12 0v1h1v-1h-1z'),
    
    // 5. Router WiFi
    router: new Path2D('M6 4h2v8H6V4zm10 0h2v8h-2V4zM2 14h20a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zm3 3v2h2v-2H5zm4 0v2h2v-2H9zm4 0v2h2v-2h-2zM9 8a3 3 0 0 1 6 0'),
    
    // 6. Network Switch / Concentrador
    switch_hub: new Path2D('M2 6h20v12H2V6zm3 4h2v4H5v-4zm4 0h2v4H9v-4zm4 0h2v4h-2v-4zm4 0h2v4h-2v-4zm3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'),
    
    // 7. Cámara CCTV / Vigilancia
    cctv_camera: new Path2D('M3 7l12-3v8l-12-3V7zm12 1l6-3v8l-6-3V8zM1 18h8v2H1v-2zm4-2h2v2H5v-2zm2 0v-4h2v4H7z'),
    
    // 8. Cámara Domo
    dome_camera: new Path2D('M2 6h20v3H2V6zm2 3a8 8 0 0 0 16 0H4zm5 3a3 3 0 0 0 6 0H9z'),
    
    // 9. Terminal / Consola Shell
    terminal: new Path2D('M2 3h20a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 4v13h18V7H3zm2 3l3 3-3 3-1.4-1.4L5.2 13l-1.6-1.6L5 10zm5 5h6v2h-6v-2z'),
    
    // 10. Código / Corchetes < / >
    code_brackets: new Path2D('M8.6 6.4L3.2 12l5.4 5.6-1.4 1.4-6.8-7 6.8-7 1.4 1.4zm6.8 0l5.4 5.6-5.4 5.6 1.4 1.4 6.8-7-6.8-7-1.4 1.4zm-5 13.2l5-15.2 1.9.6-5 15.2-1.9-.6z'),
    
    // 11. Base de Datos / SQL
    database: new Path2D('M12 2C6.5 2 2 3.3 2 5v14c0 1.7 4.5 3 10 3s10-1.3 10-3V5c0-1.7-4.5-3-10-3zm0 2c4.4 0 8 .9 8 1.5S16.4 7 12 7 4 6.1 4 5.5 7.6 4 12 4zm8 5.4c-1.7 1-4.7 1.6-8 1.6s-6.3-.6-8-1.6v2.1C4 12.1 7.6 13 12 13s8-.9 8-1.5V9.4zm0 4.5c-1.7 1-4.7 1.6-8 1.6s-6.3-.6-8-1.6V16c0 .6 3.6 1.5 8 1.5s8-.9 8-1.5v-2.1zm0 4.5c-1.7 1-4.7 1.6-8 1.6s-6.3-.6-8-1.6v2.1c0 .6 3.6 1.5 8 1.5s8-.9 8-1.5v-2.1z'),
    
    // 12. Cloud / Nube de Servidores
    cloud: new Path2D('M19.4 10a7 7 0 0 0-13.4-1.8A5 5 0 0 0 7 18h12a4 4 0 0 0 .4-8zm-7.4 0l3 3h-2v3h-2v-3H9l3-3z'),
    
    // 13. Conector Ethernet RJ45
    ethernet_rj45: new Path2D('M6 2h12v6h2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8h2V2zm2 2v4h8V4H8zm-1 6v8h10v-8H7zm2 2h1v4H9v-4zm3 0h1v4h-1v-4zm3 0h1v4h-1v-4z'),
    
    // 14. Fibra Óptica / Transmisión de Luz
    fiber_optic: new Path2D('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4a6 6 0 1 1-6 6 6 6 0 0 1 6-6zm0 3a3 3 0 1 0 3 3 3 3 0 0 0-3-3z'),
    
    // 15. Memoria USB Flash Drive
    usb_drive: new Path2D('M8 2h8v5H8V2zm1 2v1h2V4H9zm4 0v1h2V4h-2zM6 8h12a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1zm2 3v8h8v-8H8z'),
    
    // 16. Disco Duro HDD / Platos
    hard_drive: new Path2D('M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 3a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 4a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-5 7h2v1H7v-1zm4 0h6v1h-6v-1z'),
    
    // 17. Unidad SSD M.2 NVMe
    ssd_m2: new Path2D('M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 3v3h10V5H7zm0 5v4h4v-4H7zm6 0v4h4v-4h-4zm-6 6v3h2v-3H7zm4 0v3h2v-3h-2zm4 0v3h2v-3h-2z'),
    
    // 18. Memoria RAM DDR
    ram_stick: new Path2D('M2 6h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8v-2h-2v2H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm2 3v5h3V9H4zm5 0v5h3V9H9zm5 0v5h3V9h-3zm5 0v5h3V9h-3z'),
    
    // 19. Tarjeta Gráfica / GPU
    gpu_card: new Path2D('M2 5h20v14H2V5zm3 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm11 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-11 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm11 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM1 7h1v10H1V7z'),
    
    // 20. Placa Madre / Circuito PCB
    motherboard_chip: new Path2D('M3 3h18v18H3V3zm4 4h10v10H7V7zm2 2v6h6V9H9zm-6 2H1v2h2v-2zm18 0h2v2h-2v-2zm-8-8V1h-2v2h2zm0 18v2h-2v-2h2z'),
    
    // 21. Escudo de Ciberseguridad
    shield_security: new Path2D('M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-1 15l-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7z'),
    
    // 22. Candado / Criptografía SSL
    padlock: new Path2D('M6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h8V7a4 4 0 1 0-8 0v3zm4 4a2 2 0 0 0-1 3.7V20h2v-2.3A2 2 0 0 0 12 14z'),
    
    // 23. Firewall / Cortafuegos
    firewall: new Path2D('M2 4h20v16H2V4zm2 2v3h7V6H4zm9 0v3h7V6h-7zm-9 5v4h10v-4H4zm12 0v4h4v-4h-4zm-12 6v3h6v-3H4zm8 0v3h8v-3h-8z'),
    
    // 24. Smartphone Móvil
    smartphone: new Path2D('M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v13h12V5H6zm5 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0z'),
    
    // 25. Tablet
    tablet: new Path2D('M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2v14h14V5H5zm15 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'),
    
    // 26. Impresora Multifuncional
    printer: new Path2D('M6 2h12v4H6V2zm12 6H6a3 3 0 0 0-3 3v6h4v5h10v-5h4v-6a3 3 0 0 0-3-3zm-1 12H7v-4h10v4zm2-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z'),
    
    // 27. UPS / Batería de Respaldo
    ups_battery: new Path2D('M7 4h10v3h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V4zm2 2v1h6V6H9zm4 5l-4 5h3v4l4-5h-3v-4z'),
    
    // 28. Enchufe / Alimentación Eléctrica
    power_plug: new Path2D('M8 3v4h8V3h-2v3h-4V3H8zm-2 6h12v5a6 6 0 0 1-5 5.9V22h-2v-2.1A6 6 0 0 1 6 14V9z'),
    
    // 29. Rayo Eléctrico / Energía
    lightning: new Path2D('M13 2L4 13h6l-2 9 11-12h-7l3-8z'),
    
    // 30. Bluetooth
    bluetooth: new Path2D('M7 6.5l8.5 7.5L11 18V6l4.5 4-8.5 7.5M11 6v12'),
    
    // 31. Bug / Depurador de Código
    bug_debugger: new Path2D('M19 8h-2.1a6 6 0 0 0-2.3-2.3L16 4.3 14.6 3 13 4.6A6 6 0 0 0 11 4.6L9.4 3 8 4.3l1.4 1.4A6 6 0 0 0 7.1 8H5v2h2a5.9 5.9 0 0 0 0 4H5v2h2.1a6 6 0 0 0 2.3 2.3L8 19.7 9.4 21 11 19.4a6 6 0 0 0 2 0l1.6 1.6 1.4-1.3-1.4-1.4a6 6 0 0 0 2.3-2.3H19v-2h-2a5.9 5.9 0 0 0 0-4h2V8zm-4 7a3 3 0 0 1-6 0v-4a3 3 0 0 1 6 0v4z'),
    
    // 32. Git Branch / Control de Versiones
    git_branch: new Path2D('M6 3a3 3 0 1 0 2 5.2V16a3 3 0 1 0 2 .8V11a4 4 0 0 1 4-4h1.2A3 3 0 1 0 16 3a3 3 0 0 0-1.8 5.4A6 6 0 0 0 8 13.8V8.2A3 3 0 0 0 6 3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm12 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM6 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z'),
    
    // 33. Engranaje / Configuración de Sistema
    gear_settings: new Path2D('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm9.4 1.2l-1.4-.4a7.3 7.3 0 0 0-.6-1.5l.8-1.2-1.7-1.7-1.2.8a7.3 7.3 0 0 0-1.5-.6l-.4-1.4h-2.4l-.4 1.4a7.3 7.3 0 0 0-1.5.6l-1.2-.8-1.7 1.7.8 1.2a7.3 7.3 0 0 0-.6 1.5l-1.4.4v2.4l1.4.4a7.3 7.3 0 0 0 .6 1.5l-.8 1.2 1.7 1.7 1.2-.8a7.3 7.3 0 0 0 1.5.6l.4 1.4h2.4l.4-1.4a7.3 7.3 0 0 0 1.5-.6l1.2.8 1.7-1.7-.8-1.2a7.3 7.3 0 0 0 .6-1.5l1.4-.4v-2.4z'),
    
    // 34. Robot / Inteligencia Artificial
    robot_ai: new Path2D('M11 2h2v3h-2V2zM5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm3 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-9 5h10v1H7v-1zM2 12H1v3h1v-3zm20 0h1v3h-1v-3z'),
    
    // 35. Red Neuronal / Nodos IA
    neural_net: new Path2D('M5 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14-4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7-5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.8 9.2l3.4-2.4m-3.4 6.4l3.4 2.4m3.6-7.6l3.4 2.4m-3.4 4.8l3.4-2.4'),
    
    // 36. Datos Binarios 0101
    binary_data: new Path2D('M4 4h4v6H4V4zm2 2v2h0V6zm8-2h4v6h-4V4zm2 2v2h0V6zM4 14h4v6H4v-6zm2 2v2h0v-2zm8-2h4v6h-4v-6zm2 2v2h0v-2z'),
    
    // 37. Teclado Mecánico
    keyboard: new Path2D('M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 3v2h2V8H5zm4 0v2h2V8H9zm4 0v2h2V8h-2zm4 0v2h2V8h-2zm-12 4v2h2v-2H5zm4 0v2h2v-2H9zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-10 4v1h10v-1H7z'),
    
    // 38. Ratón / Mouse de Computadora
    mouse: new Path2D('M12 2C8.7 2 6 4.7 6 8v8c0 3.3 2.7 6 6 6s6-2.7 6-6V8c0-3.3-2.7-6-6-6zm-1 3v4H8V8c0-1.7 1.3-3 3-3zm2 0c1.7 0 3 1.3 3 3v1h-3V5zm3 11c0 2.2-1.8 4-4 4s-4-1.8-4-4v-5h8v5z'),
    
    // 39. Diadema / Auriculares VoIP Help Desk
    headset: new Path2D('M12 2a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h2v-7H5v-3a7 7 0 0 1 14 0v3h-3v7h2a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9zm-1 18h2v2h-2v-2z'),
    
    // 40. Antena Parabólica / Enlace Satelital
    satellite_dish: new Path2D('M4 14a10 10 0 0 0 14 0l-1.5-1.5a8 8 0 0 1-11 0L4 14zm12-9l-5 5 1.5 1.5 5-5L19 8V2h-6l3 3zM2 20h20v2H2v-2zm9-6h2v6h-2v-6z'),
    
    // 41. Torre de Transmisión / Telecomunicaciones
    antenna_tower: new Path2D('M11 2h2v3h-2V2zm-1 5h4l1 5h-6l1-5zm-3 7h10l1.5 8h-2.5L15 16h-6l-1 6H5.5L7 14zM4 5a9 9 0 0 1 16 0m-13 2a6 6 0 0 1 10 0'),
    
    // 42. Carpeta de Archivos / Directorio
    folder_code: new Path2D('M2 4h6l2 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2 4v8h16V8H4zm5 3l-1.5 1.5L9 14l-.7.7L6.8 13.2 8.3 11.7 9 11zm6 0l1.5 1.5L15 14l.7.7 1.5-1.5-1.5-1.5-.7-.7z'),
    
    // 43. Llave Criptográfica SSH / API Key
    crypto_key: new Path2D('M7 14a5 5 0 1 1 5-5h8v4h-2v2h-2v-2h-4.3A5 5 0 0 1 7 14zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'),
    
    // 44. Globo Web / Red Internet WWW
    globe_network: new Path2D('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.9a14.8 14.8 0 0 0-1.4-5A8 8 0 0 1 19.9 11zM12 4c.9 1.5 1.7 4.1 1.9 7h-3.8c.2-2.9 1-5.5 1.9-7zm-4.6 2A14.8 14.8 0 0 0 6 11H2.1a8 8 0 0 1 5.3-5zM2.1 13H6c.3 2 .8 3.7 1.4 5A8 8 0 0 1 2.1 13zm9.9 7c-.9-1.5-1.7-4.1-1.9-7h3.8c-.2 2.9-1 5.5-1.9 7zm2.6-2a14.8 14.8 0 0 0 1.4-5h3.9a8 8 0 0 1-5.3 5z'),
    
    // 45. Herramientas de Servicio Técnico / Llave & Destornillador
    tools_repair: new Path2D('M21.7 19.3l-5.6-5.6 2.1-2.1c.8.3 1.8.2 2.4-.4 1-1 1-2.6 0-3.5l-3-3a2.5 2.5 0 0 0-3.5 0c-.6.6-.7 1.6-.4 2.4l-2.1 2.1-2-2 1.4-1.4-1.4-1.4L6.8 7.2 4 4.4 2.6 5.8l2.8 2.8-2.8 2.8 1.4 1.4 2.8-2.8 2 2-5.5 5.5a1.5 1.5 0 0 0 0 2.1l2.1 2.1a1.5 1.5 0 0 0 2.1 0l5.5-5.5 2 2-2.8 2.8 1.4 1.4 2.8-2.8 2.8 2.8 1.4-1.4-2.8-2.8 2.8-2.8 1.4 1.4 1.4-1.4-2.7-2.8 2.1-2.1 5.6 5.6a1.5 1.5 0 0 0 2.1 0l.7-.7a1.5 1.5 0 0 0 0-2.1z'),
    
    // 46. Terminal POS / Punto de Venta
    pos_terminal: new Path2D('M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 3v4h8V5H8zm0 6v2h2v-2H8zm3 0v2h2v-2h-2zm3 0v2h2v-2h-2zm-6 3v2h2v-2H8zm3 0v2h2v-2h-2zm3 0v2h2v-2h-2zm-6 3v2h8v-2H8z'),
    
    // 47. Gamepad / Control de Consola / Gaming
    gamepad: new Path2D('M18 6H6a6 6 0 0 0-6 6c0 4 3 7 7 7 2 0 3-1 4-2h2c1 1 2 2 4 2 4 0 7-3 7-7a6 6 0 0 0-6-6zm-9 7H7v2H6v-2H4v-1h2v-2h1v2h2v1zm9-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-2 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'),
    
    // 48. Ventilador / Cooler Fan
    cooling_fan: new Path2D('M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 8a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm0-6a6 6 0 0 1 5.2 3A6 6 0 0 0 12 9V4zm6 8a6 6 0 0 1-3 5.2A6 6 0 0 0 15 12h5zm-8 6a6 6 0 0 1-5.2-3A6 6 0 0 0 12 15v5zm-6-8a6 6 0 0 1 3-5.2A6 6 0 0 0 9 12H4z')
  };

  const VECTOR_KEYS = Object.keys(VECTOR_PATHS);

  // Paleta de colores temáticos con transparencia calibrada
  // para que jamás opaquen las letras ni saturen la lectura
  const THEME_COLORS = [
    { stroke: 'rgba(99, 179, 237, 0.16)',  fill: 'rgba(99, 179, 237, 0.04)',  glow: 'rgba(99, 179, 237, 0.25)' }, // Azul Cyan
    { stroke: 'rgba(127, 156, 245, 0.15)', fill: 'rgba(127, 156, 245, 0.035)', glow: 'rgba(127, 156, 245, 0.22)' }, // Índigo
    { stroke: 'rgba(246, 173, 85, 0.16)',  fill: 'rgba(246, 173, 85, 0.04)',  glow: 'rgba(246, 173, 85, 0.25)' }, // Ámbar Técnico
    { stroke: 'rgba(104, 211, 145, 0.14)', fill: 'rgba(104, 211, 145, 0.03)',  glow: 'rgba(104, 211, 145, 0.2)' },  // Verde
    { stroke: 'rgba(118, 228, 247, 0.15)', fill: 'rgba(118, 228, 247, 0.035)', glow: 'rgba(118, 228, 247, 0.22)' }, // Turquesa
    { stroke: 'rgba(183, 148, 244, 0.14)', fill: 'rgba(183, 148, 244, 0.03)',  glow: 'rgba(183, 148, 244, 0.2)' }   // Púrpura
  ];

  class FloatingParticle {
    constructor(w, h, initialSpread = false) {
      this.reset(w, h, initialSpread);
    }

    reset(w, h, initialSpread = false) {
      this.key = VECTOR_KEYS[Math.floor(Math.random() * VECTOR_KEYS.length)];
      this.path = VECTOR_PATHS[this.key];
      this.color = THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)];

      // Tamaño equilibrado (entre 26px y 48px)
      this.size = 26 + Math.random() * 22;
      this.scale = this.size / 24;

      if (initialSpread) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
      } else {
        // Nacer desde los bordes de forma natural
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { // Arriba
          this.x = Math.random() * w;
          this.y = -50;
        } else if (edge === 1) { // Derecha
          this.x = w + 50;
          this.y = Math.random() * h;
        } else if (edge === 2) { // Abajo
          this.x = Math.random() * w;
          this.y = h + 50;
        } else { // Izquierda
          this.x = -50;
          this.y = Math.random() * h;
        }
      }

      // Velocidad suave y elegante (0.2 a 0.55 px por frame)
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.38;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;

      // Rotación suave
      this.rotation = Math.random() * Math.PI * 2;
      this.vRot = (Math.random() - 0.5) * 0.006;

      // Oscilación sinusoidal orgánica
      this.wavePhase = Math.random() * Math.PI * 2;
      this.waveSpeed = 0.01 + Math.random() * 0.015;
      this.waveAmp = 0.25 + Math.random() * 0.35;

      // Opacidad sutil para garantizar legibilidad 100%
      this.baseOpacity = 0.45 + Math.random() * 0.45;
      this.opacity = this.baseOpacity;
    }

    update(w, h) {
      this.wavePhase += this.waveSpeed;
      const waveX = Math.cos(this.wavePhase) * this.waveAmp;
      const waveY = Math.sin(this.wavePhase) * this.waveAmp;

      this.x += this.vx + waveX;
      this.y += this.vy + waveY;
      this.rotation += this.vRot;

      // Envolver suavemente alrededor de la pantalla con margen
      const margin = 80;
      if (this.x < -margin) this.x = w + margin;
      else if (this.x > w + margin) this.x = -margin;

      if (this.y < -margin) this.y = h + margin;
      else if (this.y > h + margin) this.y = -margin;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-12, -12); // Centrar sobre 24x24

      ctx.globalAlpha = this.opacity;
      ctx.shadowColor = this.color.glow;
      ctx.shadowBlur = 6;

      // Relleno sutil
      ctx.fillStyle = this.color.fill;
      ctx.fill(this.path);

      // Trazo vectorial nítido
      ctx.strokeStyle = this.color.stroke;
      ctx.lineWidth = 1.1;
      ctx.stroke(this.path);

      ctx.restore();
    }
  }

  function initBackgroundVectors() {
    let canvas = document.getElementById('it-bg-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'it-bg-canvas';
      canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:0; opacity:0.95; transition:opacity 0.5s ease;';
      // Insertar como primer elemento de body
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let particles = [];
    let animationFrameId = null;
    let isRunning = true;

    // Conteo optimizado: 48 figuras vectoriales activas en pantalla
    const PARTICLE_COUNT = 48;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);

      // Inicializar partículas si aún no existen
      if (particles.length === 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push(new FloatingParticle(width, height, true));
        }
      }
    }

    // Dibujar tenues conexiones de circuito entre partículas cercanas
    function drawCircuitLines() {
      const maxDist = 130;
      const maxDistSq = maxDist * maxDist;

      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.04;
            ctx.strokeStyle = 'rgba(99, 179, 237, ' + alpha + ')';
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function render() {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);

      // 1. Trazar líneas de red tenues de fondo
      drawCircuitLines();

      // 2. Renderizar cada vector de informática
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(width, height);
        p.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(render);
    }

    // Manejar redimensionamiento
    window.addEventListener('resize', resize, { passive: true });
    resize();
    render();

    // Pausar cuando la pestaña esté oculta para ahorrar recursos
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isRunning = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else {
        isRunning = true;
        render();
      }
    });
  }

  // Inicializar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackgroundVectors);
  } else {
    initBackgroundVectors();
  }
})();
