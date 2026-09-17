import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates the small synthetic study PDF used by the retrieval evaluation
 * fixture (eval/questions.json). Each page covers one distinct topic so
 * retrieval quality can be checked against a known expected page per
 * question (PLAN.md 7 — "Retrieval and citations").
 *
 * Run with: npx tsx scripts/generate-eval-fixture.ts
 */

const PAGES: { title: string; paragraphs: string[] }[] = [
  {
    title: 'Chapter 3.1 — Vectors and Vector Spaces',
    paragraphs: [
      'A vector space is a set V, together with two operations, vector addition and scalar multiplication, that satisfy eight axioms: associativity and commutativity of addition, an additive identity (the zero vector), additive inverses, distributivity of scalar multiplication over vector addition, distributivity over field addition, compatibility of scalar multiplication with field multiplication, and a multiplicative identity.',
      'A subset W of a vector space V is called a subspace if W is itself a vector space under the operations inherited from V. Equivalently, W is a subspace if it is nonempty, closed under addition, and closed under scalar multiplication. The span of a set of vectors is the smallest subspace containing all of them, formed by taking every possible linear combination.',
      'A set of vectors is linearly independent if no vector in the set can be written as a linear combination of the others. A basis of a vector space is a linearly independent spanning set; every vector space has a basis, and all bases of a finite-dimensional space contain the same number of vectors, called the dimension of the space.',
    ],
  },
  {
    title: 'Chapter 3.2 — Matrix Operations',
    paragraphs: [
      'Matrix addition is defined entrywise and requires both matrices to have the same dimensions. Matrix multiplication, by contrast, combines an m-by-n matrix with an n-by-p matrix to produce an m-by-p matrix, where each entry is the dot product of a row of the first matrix and a column of the second. Matrix multiplication is associative but not commutative in general.',
      'The transpose of a matrix A, written A^T, is formed by flipping A over its main diagonal, turning rows into columns. A square matrix is symmetric if it equals its own transpose. The identity matrix I acts as a multiplicative identity: for any compatible matrix A, AI = IA = A.',
      'A square matrix A is invertible if there exists a matrix A^-1 such that AA^-1 = A^-1A = I. Not every square matrix has an inverse; a matrix is invertible exactly when its determinant is nonzero, equivalently when its columns are linearly independent.',
    ],
  },
  {
    title: 'Chapter 3.3 — Determinants',
    paragraphs: [
      'The determinant is a scalar value that can be computed from a square matrix and encodes several properties of the linear map the matrix represents. For a 2-by-2 matrix [[a, b], [c, d]], the determinant is ad minus bc. For larger matrices, the determinant can be computed recursively by cofactor expansion along any row or column.',
      'A key property of determinants is that a matrix is invertible if and only if its determinant is nonzero. Geometrically, the absolute value of the determinant of a 2-by-2 or 3-by-3 matrix equals the area or volume scaling factor of the linear transformation the matrix represents; a negative determinant indicates the transformation reverses orientation.',
      'Determinants are multiplicative: det(AB) = det(A) det(B) for any two square matrices of the same size of the same size. The determinant of a triangular matrix (upper or lower) is simply the product of its diagonal entries, which is often the fastest way to compute it after row reduction.',
    ],
  },
  {
    title: 'Chapter 3.4 — Eigenvalues and Eigenvectors',
    paragraphs: [
      'A nonzero vector v is an eigenvector of a square matrix A if Av = lambda*v for some scalar lambda, called the eigenvalue associated with v. Eigenvalues are found by solving the characteristic equation det(A - lambda*I) = 0, a polynomial equation in lambda whose degree equals the size of the matrix.',
      'The set of all eigenvectors corresponding to a single eigenvalue, together with the zero vector, forms a subspace called the eigenspace for that eigenvalue. A matrix is diagonalizable if it has enough linearly independent eigenvectors to form a basis for the whole space; in that case A = PDP^-1, where D is diagonal and its entries are the eigenvalues.',
      'Eigenvalues and eigenvectors show up throughout applied mathematics: they describe the natural modes of vibrating systems, the steady-state behavior of Markov chains, and the principal components used in dimensionality reduction techniques such as PCA.',
    ],
  },
  {
    title: 'Chapter 3.5 — Linear Transformations',
    paragraphs: [
      'A linear transformation T from vector space V to vector space W is a function that preserves vector addition and scalar multiplication: T(u + v) = T(u) + T(v) and T(c*v) = c*T(v) for all vectors u, v and scalars c. Every linear transformation between finite-dimensional spaces can be represented by a matrix once bases are chosen for V and W.',
      'The kernel (or null space) of a linear transformation T is the set of vectors that T maps to zero; the image (or range) is the set of all outputs T can produce. The rank-nullity theorem states that the dimension of the domain equals the dimension of the kernel plus the dimension of the image.',
      'Composing two linear transformations corresponds to multiplying their matrix representations. This is why matrix multiplication is defined the way it is: it makes matrix multiplication mirror function composition, so that the matrix for T2 composed with T1 equals the matrix of T2 times the matrix of T1.',
    ],
  },
];

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle('Linear Algebra — Chapter 3: Vector Spaces and Linear Maps');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;

  for (const { title, paragraphs } of PAGES) {
    const page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText(title, { x: margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= 34;

    for (const paragraph of paragraphs) {
      const lines = wrapText(paragraph, font, 11, maxWidth);
      for (const line of lines) {
        if (y < margin) break;
        page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
        y -= 16;
      }
      y -= 10;
    }
  }

  const bytes = await doc.save();
  const outDir = path.resolve(process.cwd(), 'eval');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'Linear_Algebra_Ch3.pdf');
  await writeFile(outPath, bytes);
  console.log(`Wrote ${outPath} (${PAGES.length} pages, ${(bytes.length / 1024).toFixed(0)} KB)`);
}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
