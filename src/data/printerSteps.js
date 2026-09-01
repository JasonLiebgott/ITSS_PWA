export const printerSteps = [
  {
    title: 'Confirm the laptop is on the new network',
    detail:
      'Verify the device is connected to the current support network before attempting printer discovery or IP-based setup.',
  },
  {
    title: 'Power-cycle the printer',
    detail:
      'Restart the printer after it joins the new network so it can pull a fresh address and expose services cleanly.',
  },
  {
    title: 'Check for an existing install on the laptop',
    detail:
      'Look for the printer under another name in Windows Devices and Printers before creating a duplicate queue.',
  },
  {
    title: 'Add the printer manually by IP',
    detail:
      'Use Windows Add Printer flow, choose TCP/IP or IP address entry, and point the queue to the printer IP.',
  },
  {
    title: 'Choose the Microsoft PCL 6 driver',
    detail:
      'Select Microsoft PCL 6 during driver selection so the queue uses the standard supported print path.',
  },
];
