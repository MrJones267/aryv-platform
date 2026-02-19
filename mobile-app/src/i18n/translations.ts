/**
 * @fileoverview Translation strings for multi-language support
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

export type TranslationKey = keyof typeof en;

const en = {
  // Common
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',
  'common.skip': 'Skip',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.retry': 'Retry',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.share': 'Share',
  'common.apply': 'Apply',
  'common.close': 'Close',

  // Home
  'home.greeting.morning': 'Good morning',
  'home.greeting.afternoon': 'Good afternoon',
  'home.greeting.evening': 'Good evening',
  'home.whereAreYouGoing': 'Where are you going?',
  'home.findRide': 'Find a Ride',
  'home.offerRide': 'Offer a Ride',
  'home.sendPackage': 'Send Package',
  'home.deliverPackages': 'Deliver Packages',
  'home.nearbyRides': 'Nearby Rides',
  'home.noRidesNearby': 'No rides nearby',
  'home.sos': 'SOS',

  // Rides
  'rides.myRides': 'My Rides',
  'rides.rideDetails': 'Ride Details',
  'rides.createRide': 'Create Ride',
  'rides.bookRide': 'Book Ride',
  'rides.searchRides': 'Search Rides',
  'rides.from': 'From',
  'rides.to': 'To',
  'rides.departure': 'Departure',
  'rides.seats': 'seats',
  'rides.seatAvailable': 'seat available',
  'rides.seatsAvailable': 'seats available',
  'rides.pricePerSeat': 'per seat',
  'rides.bookNow': 'Book Now',
  'rides.shareTrip': 'Share Trip',
  'rides.callDriver': 'Call Driver',
  'rides.messageDriver': 'Message Driver',
  'rides.cancelRide': 'Cancel Ride',
  'rides.rateTrip': 'Rate Your Trip',
  'rides.tripCompleted': 'Trip Completed',

  // Rating
  'rating.title': 'Rate Your Trip',
  'rating.howWas': 'How was your trip with',
  'rating.whatWentWell': 'What went well?',
  'rating.additionalComments': 'Additional comments (optional)',
  'rating.submitRating': 'Submit Rating',
  'rating.ratingRequired': 'Rating Required',
  'rating.selectStar': 'Please select a star rating before submitting.',
  'rating.thankYou': 'Thank You!',
  'rating.submitted': 'Your rating has been submitted.',
  'rating.poor': 'Poor',
  'rating.belowAverage': 'Below Average',
  'rating.good': 'Good',
  'rating.great': 'Great',
  'rating.excellent': 'Excellent',

  // Tipping
  'tip.addTip': 'Add a tip?',
  'tip.allGoesToDriver': '100% of tips go directly to your driver',
  'tip.custom': 'Custom',
  'tip.selectAmount': 'Select tip amount',
  'tip.noThanks': 'No thanks',
  'tip.thankYou': 'Thank you!',
  'tip.sentToDriver': 'Your tip has been sent to the driver',

  // Receipt
  'receipt.title': 'Ride Receipt',
  'receipt.shareReceipt': 'Share Receipt',
  'receipt.rideFare': 'Ride fare',
  'receipt.promoDiscount': 'Promo discount',
  'receipt.driverTip': 'Driver tip',
  'receipt.total': 'Total',
  'receipt.paidVia': 'Paid via',

  // Promo
  'promo.enterCode': 'Enter promo code',
  'promo.invalidCode': 'Invalid promo code',
  'promo.expired': 'This code has expired',
  'promo.notApplicable': 'Code not applicable to this ride',
  'promo.validationFailed': 'Could not validate code',
  'promo.minRideAmount': 'Minimum ride amount',

  // Profile
  'profile.title': 'Profile',
  'profile.editProfile': 'Edit Profile',
  'profile.settings': 'Settings',
  'profile.darkMode': 'Dark Mode',
  'profile.notifications': 'Notifications',
  'profile.privacy': 'Privacy',
  'profile.currency': 'Currency & Region',
  'profile.language': 'Language',
  'profile.security': 'Security',
  'profile.help': 'Help & Support',
  'profile.about': 'About',
  'profile.logout': 'Log Out',

  // Messages
  'messages.title': 'Messages',
  'messages.noMessages': 'No messages yet',
  'messages.typeMessage': 'Type a message...',

  // Courier
  'courier.title': 'Courier',
  'courier.sendPackage': 'Send Package',
  'courier.trackPackage': 'Track Package',

  // Offline
  'offline.youreOffline': "You're offline",
  'offline.limitedFeatures': 'Some features may be limited',
  'offline.pending': 'pending',
  'offline.backOnline': 'Back online',

  // Auth
  'auth.login': 'Log In',
  'auth.register': 'Register',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot Password?',
  'auth.createAccount': 'Create Account',

  // Emergency
  'emergency.routeDeviation': 'Route deviation detected',
  'emergency.callEmergency': 'Call Emergency',
  'emergency.contacts': 'Emergency Contacts',
};

const tn: Record<TranslationKey, string> = {
  // Common
  'common.ok': 'Go siame',
  'common.cancel': 'Khansela',
  'common.save': 'Boloka',
  'common.done': 'Go weditswe',
  'common.skip': 'Tlola',
  'common.next': 'E e latelang',
  'common.back': 'Morago',
  'common.search': 'Batla',
  'common.loading': 'E a tsenya...',
  'common.retry': 'Leka gape',
  'common.error': 'Phoso',
  'common.success': 'Go atlegile',
  'common.confirm': 'Netefatsa',
  'common.delete': 'Phimola',
  'common.edit': 'Fetola',
  'common.share': 'Abelana',
  'common.apply': 'Dirisetsa',
  'common.close': 'Tswala',

  // Home
  'home.greeting.morning': 'Dumela',
  'home.greeting.afternoon': 'Dumela',
  'home.greeting.evening': 'Dumela',
  'home.whereAreYouGoing': 'O ya kae?',
  'home.findRide': 'Batla Leeto',
  'home.offerRide': 'Neela Leeto',
  'home.sendPackage': 'Romela Sephuthelwana',
  'home.deliverPackages': 'Isa Diphuthelwana',
  'home.nearbyRides': 'Maeto a Gaufi',
  'home.noRidesNearby': 'Ga go na maeto a gaufi',
  'home.sos': 'SOS',

  // Rides
  'rides.myRides': 'Maeto a Me',
  'rides.rideDetails': 'Dintlha tsa Leeto',
  'rides.createRide': 'Tlhama Leeto',
  'rides.bookRide': 'Buka Leeto',
  'rides.searchRides': 'Batla Maeto',
  'rides.from': 'Go tswa',
  'rides.to': 'Go ya',
  'rides.departure': 'Nako ya go tsamaya',
  'rides.seats': 'ditulo',
  'rides.seatAvailable': 'setulo se se teng',
  'rides.seatsAvailable': 'ditulo tse di teng',
  'rides.pricePerSeat': 'ka setulo',
  'rides.bookNow': 'Buka Jaanong',
  'rides.shareTrip': 'Abelana Leeto',
  'rides.callDriver': 'Leletsa Mokgweetsi',
  'rides.messageDriver': 'Romela Molaetsa',
  'rides.cancelRide': 'Khansela Leeto',
  'rides.rateTrip': 'Sekaseka Leeto',
  'rides.tripCompleted': 'Leeto le Weditswe',

  // Rating
  'rating.title': 'Sekaseka Leeto la Gago',
  'rating.howWas': 'Leeto la gago le ne le ntse jang le',
  'rating.whatWentWell': 'Eng e ne e le siame?',
  'rating.additionalComments': 'Mafoko a mangwe (ga a tlamege)',
  'rating.submitRating': 'Romela Tshekatsheko',
  'rating.ratingRequired': 'Tshekatsheko e a Tlhokega',
  'rating.selectStar': 'Ka kopo tlhopha naledi pele o romela.',
  'rating.thankYou': 'Ke a Leboga!',
  'rating.submitted': 'Tshekatsheko ya gago e rometse.',
  'rating.poor': 'E maswe',
  'rating.belowAverage': 'Ka fa tlase ga tatelano',
  'rating.good': 'E siame',
  'rating.great': 'E ntle',
  'rating.excellent': 'E ntle thata',

  // Tipping
  'tip.addTip': 'Tsenya motshelo?',
  'tip.allGoesToDriver': 'Motshelo otlhe o ya kwa mokgweetising',
  'tip.custom': 'Ka bowena',
  'tip.selectAmount': 'Tlhopha selekanyo sa motshelo',
  'tip.noThanks': 'Nnyaa ke a leboga',
  'tip.thankYou': 'Ke a leboga!',
  'tip.sentToDriver': 'Motshelo wa gago o rometswe kwa mokgweetising',

  // Receipt
  'receipt.title': 'Risiti ya Leeto',
  'receipt.shareReceipt': 'Abelana Risiti',
  'receipt.rideFare': 'Tuelo ya leeto',
  'receipt.promoDiscount': 'Phokotso ya promo',
  'receipt.driverTip': 'Motshelo wa mokgweetsi',
  'receipt.total': 'Palogotlhe',
  'receipt.paidVia': 'Go duetswe ka',

  // Promo
  'promo.enterCode': 'Tsenya khoutu ya promo',
  'promo.invalidCode': 'Khoutu ya promo e fosagetseng',
  'promo.expired': 'Khoutu e e fedile',
  'promo.notApplicable': 'Khoutu ga e direle leeto leno',
  'promo.validationFailed': 'Ga re ka re netefatsa khoutu',
  'promo.minRideAmount': 'Palogonnye ya leeto',

  // Profile
  'profile.title': 'Porofaele',
  'profile.editProfile': 'Fetola Porofaele',
  'profile.settings': 'Dithulaganyo',
  'profile.darkMode': 'Mokgwa wa Lefifi',
  'profile.notifications': 'Dikitsiso',
  'profile.privacy': 'Poraefesi',
  'profile.currency': 'Madi & Kgaolo',
  'profile.language': 'Puo',
  'profile.security': 'Tshireletso',
  'profile.help': 'Thuso & Tshegetso',
  'profile.about': 'Ka ga',
  'profile.logout': 'Tswa',

  // Messages
  'messages.title': 'Melaetsa',
  'messages.noMessages': 'Ga go na melaetsa',
  'messages.typeMessage': 'Kwala molaetsa...',

  // Courier
  'courier.title': 'Motho o Isang',
  'courier.sendPackage': 'Romela Sephuthelwana',
  'courier.trackPackage': 'Latela Sephuthelwana',

  // Offline
  'offline.youreOffline': 'Ga o ka kopana',
  'offline.limitedFeatures': 'Ditirelo dingwe di lekanyeditswe',
  'offline.pending': 'e emetse',
  'offline.backOnline': 'O boetse ka inthanete',

  // Auth
  'auth.login': 'Tsena',
  'auth.register': 'Ikwadise',
  'auth.email': 'Imeile',
  'auth.password': 'Lefoko la sephiri',
  'auth.forgotPassword': 'O Lebetse Lefoko la Sephiri?',
  'auth.createAccount': 'Tlhama Akhaonto',

  // Emergency
  'emergency.routeDeviation': 'Go lemogilwe phetogo ya tsela',
  'emergency.callEmergency': 'Leletsa Maemo a Tshoganyetso',
  'emergency.contacts': 'Bao ba Ikgolaganywang le Bone ka Tshoganyetso',
};

const af: Record<TranslationKey, string> = {
  // Common
  'common.ok': 'Goed',
  'common.cancel': 'Kanselleer',
  'common.save': 'Stoor',
  'common.done': 'Klaar',
  'common.skip': 'Slaan oor',
  'common.next': 'Volgende',
  'common.back': 'Terug',
  'common.search': 'Soek',
  'common.loading': 'Laai...',
  'common.retry': 'Probeer weer',
  'common.error': 'Fout',
  'common.success': 'Sukses',
  'common.confirm': 'Bevestig',
  'common.delete': 'Verwyder',
  'common.edit': 'Wysig',
  'common.share': 'Deel',
  'common.apply': 'Pas toe',
  'common.close': 'Sluit',

  // Home
  'home.greeting.morning': 'Goeie more',
  'home.greeting.afternoon': 'Goeie middag',
  'home.greeting.evening': 'Goeie aand',
  'home.whereAreYouGoing': 'Waarheen gaan jy?',
  'home.findRide': 'Soek \'n Rit',
  'home.offerRide': 'Bied \'n Rit',
  'home.sendPackage': 'Stuur Pakket',
  'home.deliverPackages': 'Lewer Pakkette',
  'home.nearbyRides': 'Nabye Ritte',
  'home.noRidesNearby': 'Geen ritte naby nie',
  'home.sos': 'SOS',

  // Rides
  'rides.myRides': 'My Ritte',
  'rides.rideDetails': 'Rit Besonderhede',
  'rides.createRide': 'Skep Rit',
  'rides.bookRide': 'Bespreek Rit',
  'rides.searchRides': 'Soek Ritte',
  'rides.from': 'Van',
  'rides.to': 'Na',
  'rides.departure': 'Vertrek',
  'rides.seats': 'sitplekke',
  'rides.seatAvailable': 'sitplek beskikbaar',
  'rides.seatsAvailable': 'sitplekke beskikbaar',
  'rides.pricePerSeat': 'per sitplek',
  'rides.bookNow': 'Bespreek Nou',
  'rides.shareTrip': 'Deel Reis',
  'rides.callDriver': 'Skakel Bestuurder',
  'rides.messageDriver': 'Boodskap Bestuurder',
  'rides.cancelRide': 'Kanselleer Rit',
  'rides.rateTrip': 'Beoordeel Reis',
  'rides.tripCompleted': 'Reis Voltooi',

  // Rating
  'rating.title': 'Beoordeel Jou Reis',
  'rating.howWas': 'Hoe was jou reis met',
  'rating.whatWentWell': 'Wat het goed gegaan?',
  'rating.additionalComments': 'Bykomende kommentaar (opsioneel)',
  'rating.submitRating': 'Dien Beoordeling In',
  'rating.ratingRequired': 'Beoordeling Vereis',
  'rating.selectStar': 'Kies asseblief \'n sterbeoordeling voor indiening.',
  'rating.thankYou': 'Dankie!',
  'rating.submitted': 'Jou beoordeling is ingedien.',
  'rating.poor': 'Swak',
  'rating.belowAverage': 'Onder Gemiddeld',
  'rating.good': 'Goed',
  'rating.great': 'Uitstekend',
  'rating.excellent': 'Voortreflik',

  // Tipping
  'tip.addTip': 'Voeg \'n fooitjie by?',
  'tip.allGoesToDriver': '100% van fooitjies gaan direk na jou bestuurder',
  'tip.custom': 'Aangepas',
  'tip.selectAmount': 'Kies fooitjie bedrag',
  'tip.noThanks': 'Nee dankie',
  'tip.thankYou': 'Dankie!',
  'tip.sentToDriver': 'Jou fooitjie is aan die bestuurder gestuur',

  // Receipt
  'receipt.title': 'Rit Kwitansie',
  'receipt.shareReceipt': 'Deel Kwitansie',
  'receipt.rideFare': 'Rit tarief',
  'receipt.promoDiscount': 'Promo afslag',
  'receipt.driverTip': 'Bestuurder fooitjie',
  'receipt.total': 'Totaal',
  'receipt.paidVia': 'Betaal via',

  // Promo
  'promo.enterCode': 'Voer promokode in',
  'promo.invalidCode': 'Ongeldige promokode',
  'promo.expired': 'Hierdie kode het verval',
  'promo.notApplicable': 'Kode nie van toepassing op hierdie rit nie',
  'promo.validationFailed': 'Kon nie kode bevestig nie',
  'promo.minRideAmount': 'Minimum rit bedrag',

  // Profile
  'profile.title': 'Profiel',
  'profile.editProfile': 'Wysig Profiel',
  'profile.settings': 'Instellings',
  'profile.darkMode': 'Donker Modus',
  'profile.notifications': 'Kennisgewings',
  'profile.privacy': 'Privaatheid',
  'profile.currency': 'Geldeenheid & Streek',
  'profile.language': 'Taal',
  'profile.security': 'Sekuriteit',
  'profile.help': 'Hulp & Ondersteuning',
  'profile.about': 'Omtrent',
  'profile.logout': 'Teken Uit',

  // Messages
  'messages.title': 'Boodskappe',
  'messages.noMessages': 'Nog geen boodskappe nie',
  'messages.typeMessage': 'Tik \'n boodskap...',

  // Courier
  'courier.title': 'Koerier',
  'courier.sendPackage': 'Stuur Pakket',
  'courier.trackPackage': 'Spoor Pakket',

  // Offline
  'offline.youreOffline': 'Jy is vanlyn',
  'offline.limitedFeatures': 'Sommige kenmerke mag beperk wees',
  'offline.pending': 'hangend',
  'offline.backOnline': 'Terug aanlyn',

  // Auth
  'auth.login': 'Teken In',
  'auth.register': 'Registreer',
  'auth.email': 'E-pos',
  'auth.password': 'Wagwoord',
  'auth.forgotPassword': 'Wagwoord Vergeet?',
  'auth.createAccount': 'Skep Rekening',

  // Emergency
  'emergency.routeDeviation': 'Roete afwyking bespeur',
  'emergency.callEmergency': 'Skakel Nooddiens',
  'emergency.contacts': 'Noodkontakte',
};

export const translations: Record<string, Record<TranslationKey, string>> = {
  en,
  tn,
  af,
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'tn', name: 'Tswana', nativeName: 'Setswana' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
] as const;

export default translations;
