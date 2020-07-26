// This enabled module augmentation mode.
import 'date-wizard';

declare module 'date-wizard' {
    // Add your module extensions here.
    function pad(num: number): string;
    interface ExtendedDateDetails extends DateDetails {
        hours: number;
    }
    function dateDetails(date: Date): ExtendedDateDetails;
}
